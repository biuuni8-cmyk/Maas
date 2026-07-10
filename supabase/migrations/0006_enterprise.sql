-- Maas 0006: Enterprise administration, API access, webhooks,
-- notifications, usage tracking, and security events.
--
-- This migration is idempotent and safe to rerun after a partial failure.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Role helper
-- ---------------------------------------------------------------------------

create or replace function public.company_role(target_company_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select cm.role::text
  from public.company_members as cm
  where cm.company_id = target_company_id
    and cm.user_id = auth.uid()
  limit 1
$$;

revoke all on function public.company_role(uuid) from public;
grant execute on function public.company_role(uuid) to authenticated;
grant execute on function public.company_role(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default array['read']::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint api_keys_name_not_blank
    check (length(trim(name)) > 0),

  constraint api_keys_prefix_not_blank
    check (length(trim(key_prefix)) > 0)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  severity text not null default 'info',
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),

  constraint notifications_severity_valid
    check (severity in ('info', 'success', 'warning', 'error', 'critical')),

  constraint notifications_title_not_blank
    check (length(trim(title)) > 0)
);

create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  url text not null,
  secret_hash text not null,
  events text[] not null default array[]::text[],
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint webhook_endpoint_url_not_blank
    check (length(trim(url)) > 0)
);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  endpoint_id uuid not null
    references public.webhook_endpoints(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  response_code integer,
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),

  constraint webhook_delivery_status_valid
    check (status in ('pending', 'processing', 'delivered', 'failed', 'cancelled')),

  constraint webhook_delivery_attempts_nonnegative
    check (attempts >= 0)
);

create table if not exists public.usage_counters (
  company_id uuid not null references public.companies(id) on delete cascade,
  period_start date not null,
  api_requests bigint not null default 0,
  imports bigint not null default 0,
  exports bigint not null default 0,
  storage_bytes bigint not null default 0,
  updated_at timestamptz not null default now(),

  primary key (company_id, period_start),

  constraint usage_api_requests_nonnegative check (api_requests >= 0),
  constraint usage_imports_nonnegative check (imports >= 0),
  constraint usage_exports_nonnegative check (exports >= 0),
  constraint usage_storage_nonnegative check (storage_bytes >= 0)
);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint security_event_type_not_blank
    check (length(trim(event_type)) > 0)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists api_keys_company_id_idx
  on public.api_keys(company_id);

create index if not exists api_keys_active_lookup_idx
  on public.api_keys(key_hash)
  where revoked_at is null;

create index if not exists notifications_company_created_idx
  on public.notifications(company_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, created_at desc)
  where read_at is null;

create index if not exists webhook_endpoints_company_idx
  on public.webhook_endpoints(company_id);

create index if not exists webhook_deliveries_endpoint_created_idx
  on public.webhook_deliveries(endpoint_id, created_at desc);

create index if not exists webhook_deliveries_retry_idx
  on public.webhook_deliveries(status, next_attempt_at)
  where status in ('pending', 'failed');

create index if not exists security_events_company_created_idx
  on public.security_events(company_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.api_keys enable row level security;
alter table public.notifications enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.usage_counters enable row level security;
alter table public.security_events enable row level security;

drop policy if exists "members read api keys" on public.api_keys;
drop policy if exists "admins manage api keys" on public.api_keys;
drop policy if exists "users read notifications" on public.notifications;
drop policy if exists "users update notifications" on public.notifications;
drop policy if exists "admins manage webhooks" on public.webhook_endpoints;
drop policy if exists "admins read deliveries" on public.webhook_deliveries;
drop policy if exists "members read usage" on public.usage_counters;
drop policy if exists "admins read security events" on public.security_events;

create policy "members read api keys"
on public.api_keys
for select
to authenticated
using (
  public.is_company_member(company_id)
);

create policy "admins manage api keys"
on public.api_keys
for all
to authenticated
using (
  public.company_role(company_id) in ('owner', 'admin')
)
with check (
  public.company_role(company_id) in ('owner', 'admin')
);

create policy "users read notifications"
on public.notifications
for select
to authenticated
using (
  public.is_company_member(company_id)
  and (user_id is null or user_id = auth.uid())
);

create policy "users update notifications"
on public.notifications
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
  and public.is_company_member(company_id)
);

create policy "admins manage webhooks"
on public.webhook_endpoints
for all
to authenticated
using (
  public.company_role(company_id) in ('owner', 'admin')
)
with check (
  public.company_role(company_id) in ('owner', 'admin')
);

create policy "admins read deliveries"
on public.webhook_deliveries
for select
to authenticated
using (
  public.company_role(company_id) in ('owner', 'admin')
);

create policy "members read usage"
on public.usage_counters
for select
to authenticated
using (
  public.is_company_member(company_id)
);

create policy "admins read security events"
on public.security_events
for select
to authenticated
using (
  public.company_role(company_id) in ('owner', 'admin')
);

-- ---------------------------------------------------------------------------
-- Usage counter function
-- ---------------------------------------------------------------------------

create or replace function public.increment_api_usage(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usage_counters (
    company_id,
    period_start,
    api_requests
  )
  values (
    p_company_id,
    date_trunc('month', now())::date,
    1
  )
  on conflict (company_id, period_start)
  do update
  set
    api_requests = public.usage_counters.api_requests + 1,
    updated_at = now();
end
$$;

revoke all on function public.increment_api_usage(uuid) from public;
grant execute on function public.increment_api_usage(uuid) to authenticated;
grant execute on function public.increment_api_usage(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Realtime publication
-- Add tables only when they are not already present.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime
      add table public.notifications;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'webhook_deliveries'
  ) then
    alter publication supabase_realtime
      add table public.webhook_deliveries;
  end if;
end
$$;