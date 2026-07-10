create extension if not exists pgcrypto;

create type public.company_role as enum ('owner','admin','analyst','viewer');
create type public.company_status as enum ('active','inactive','suspended');
create type public.product_status as enum ('active','draft','archived');
create type public.audit_status as enum ('pending','running','passed','failed');
create type public.audit_period as enum ('daily','weekly','monthly','3_months','6_months','9_months','12_months','yearly');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  slug text not null unique,
  industry text,
  status public.company_status not null default 'active',
  timezone text not null default 'UTC',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.company_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key(company_id,user_id)
);
create table public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role public.company_role not null,
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sku text not null,
  name text not null,
  category text,
  price numeric(14,2),
  currency char(3) not null default 'USD',
  quality_score numeric(5,2) check (quality_score between 0 and 100),
  status public.product_status not null default 'active',
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,sku)
);
create table public.audits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period_type public.audit_period not null,
  period_start date not null,
  period_end date not null,
  status public.audit_status not null default 'pending',
  issues_found integer not null default 0 check (issues_found >= 0),
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);
create table public.company_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period_type public.audit_period not null,
  period_start date not null,
  period_end date not null,
  revenue numeric(16,2),
  currency char(3) not null default 'USD',
  product_count integer check (product_count >= 0),
  quality_score numeric(5,2) check (quality_score between 0 and 100),
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(company_id,period_type,period_start,period_end)
);
create table public.activity_log (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id text,
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index products_company_updated_idx on public.products(company_id,updated_at desc);
create index audits_company_period_idx on public.audits(company_id,period_start desc);
create index metrics_company_period_idx on public.company_metrics(company_id,period_start desc);
create index activity_company_created_idx on public.activity_log(company_id,created_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger companies_touch before update on public.companies for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,full_name) values(new.id,new.raw_user_meta_data->>'full_name') on conflict do nothing; return new; end $$;
create trigger auth_user_profile after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_company_member(target_company uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.company_members m where m.company_id=target_company and m.user_id=auth.uid()) $$;
create or replace function public.company_role_for(target_company uuid) returns public.company_role language sql stable security definer set search_path=public as $$ select role from public.company_members where company_id=target_company and user_id=auth.uid() $$;
create or replace function public.can_manage_company(target_company uuid) returns boolean language sql stable security definer set search_path=public as $$ select coalesce(public.company_role_for(target_company) in ('owner','admin'),false) $$;
create or replace function public.can_edit_company_data(target_company uuid) returns boolean language sql stable security definer set search_path=public as $$ select coalesce(public.company_role_for(target_company) in ('owner','admin','analyst'),false) $$;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.company_invitations enable row level security;
alter table public.products enable row level security;
alter table public.audits enable row level security;
alter table public.company_metrics enable row level security;
alter table public.activity_log enable row level security;

create policy profiles_self_read on public.profiles for select using (id=auth.uid());
create policy profiles_self_update on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());
create policy companies_read on public.companies for select using (public.is_company_member(id));
create policy companies_create on public.companies for insert with check (owner_id=auth.uid());
create policy companies_manage on public.companies for update using (public.can_manage_company(id)) with check (public.can_manage_company(id));
create policy members_read on public.company_members for select using (public.is_company_member(company_id));
create policy members_add on public.company_members for insert with check (user_id=auth.uid() or public.can_manage_company(company_id));
create policy members_manage on public.company_members for update using (public.can_manage_company(company_id)) with check (public.can_manage_company(company_id));
create policy members_delete on public.company_members for delete using (public.can_manage_company(company_id) and role <> 'owner');
create policy invitations_manage on public.company_invitations for all using (public.can_manage_company(company_id)) with check (public.can_manage_company(company_id));
create policy products_read on public.products for select using (public.is_company_member(company_id));
create policy products_write on public.products for insert with check (public.can_edit_company_data(company_id));
create policy products_update on public.products for update using (public.can_edit_company_data(company_id)) with check (public.can_edit_company_data(company_id));
create policy products_delete on public.products for delete using (public.can_manage_company(company_id));
create policy audits_read on public.audits for select using (public.is_company_member(company_id));
create policy audits_write on public.audits for all using (public.can_edit_company_data(company_id)) with check (public.can_edit_company_data(company_id));
create policy metrics_read on public.company_metrics for select using (public.is_company_member(company_id));
create policy metrics_write on public.company_metrics for all using (public.can_edit_company_data(company_id)) with check (public.can_edit_company_data(company_id));
create policy activity_read on public.activity_log for select using (public.is_company_member(company_id));
create policy activity_insert on public.activity_log for insert with check (public.can_edit_company_data(company_id));

do $$ begin alter publication supabase_realtime add table public.companies; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.products; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.audits; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.company_metrics; exception when duplicate_object then null; end $$;
