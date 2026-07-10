create type public.audit_severity as enum ('info','warning','critical');
create type public.audit_issue_status as enum ('open','acknowledged','resolved','dismissed');
create type public.audit_schedule_status as enum ('active','paused');

alter table public.audits
  add column if not exists title text,
  add column if not exists score numeric(5,2) check (score between 0 and 100),
  add column if not exists comparison_audit_id uuid references public.audits(id) on delete set null,
  add column if not exists metrics_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists comparison_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists generated_by text not null default 'manual';

create table public.audit_issues (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  severity public.audit_severity not null default 'warning',
  status public.audit_issue_status not null default 'open',
  category text not null,
  title text not null,
  description text,
  entity_type text,
  entity_id text,
  observed_value jsonb,
  expected_value jsonb,
  resolution_note text,
  assigned_to uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_schedules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period_type public.audit_period not null,
  status public.audit_schedule_status not null default 'active',
  run_hour smallint not null default 2 check (run_hour between 0 and 23),
  timezone text not null default 'UTC',
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,period_type)
);

create table public.audit_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approved','changes_requested')),
  note text,
  created_at timestamptz not null default now()
);

create index audit_issues_audit_status_idx on public.audit_issues(audit_id,status,severity);
create index audit_schedules_company_idx on public.audit_schedules(company_id,status);
create index audit_reviews_audit_idx on public.audit_reviews(audit_id,created_at desc);

create trigger audit_issues_touch before update on public.audit_issues for each row execute function public.touch_updated_at();
create trigger audit_schedules_touch before update on public.audit_schedules for each row execute function public.touch_updated_at();

alter table public.audit_issues enable row level security;
alter table public.audit_schedules enable row level security;
alter table public.audit_reviews enable row level security;

create policy audit_issues_read on public.audit_issues for select using (public.is_company_member(company_id));
create policy audit_issues_write on public.audit_issues for all using (public.can_edit_company_data(company_id)) with check (public.can_edit_company_data(company_id));
create policy audit_schedules_read on public.audit_schedules for select using (public.is_company_member(company_id));
create policy audit_schedules_write on public.audit_schedules for all using (public.can_manage_company(company_id)) with check (public.can_manage_company(company_id));
create policy audit_reviews_read on public.audit_reviews for select using (public.is_company_member(company_id));
create policy audit_reviews_write on public.audit_reviews for insert with check (reviewer_id=auth.uid() and public.can_edit_company_data(company_id));

create or replace function public.period_bounds(target_period public.audit_period, anchor_date date default current_date)
returns table(period_start date, period_end date)
language plpgsql stable as $$
begin
  case target_period
    when 'daily' then return query select anchor_date, anchor_date;
    when 'weekly' then return query select date_trunc('week',anchor_date)::date, (date_trunc('week',anchor_date)+interval '6 days')::date;
    when 'monthly' then return query select date_trunc('month',anchor_date)::date, (date_trunc('month',anchor_date)+interval '1 month - 1 day')::date;
    when '3_months' then return query select (anchor_date-interval '3 months'+interval '1 day')::date, anchor_date;
    when '6_months' then return query select (anchor_date-interval '6 months'+interval '1 day')::date, anchor_date;
    when '9_months' then return query select (anchor_date-interval '9 months'+interval '1 day')::date, anchor_date;
    when '12_months' then return query select (anchor_date-interval '12 months'+interval '1 day')::date, anchor_date;
    when 'yearly' then return query select date_trunc('year',anchor_date)::date, (date_trunc('year',anchor_date)+interval '1 year - 1 day')::date;
  end case;
end $$;

create or replace function public.previous_period_bounds(target_period public.audit_period, current_start date, current_end date)
returns table(period_start date, period_end date)
language sql stable as $$
  select current_start - (current_end-current_start+1), current_start-1;
$$;

do $$ begin alter publication supabase_realtime add table public.audit_issues; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.audit_schedules; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.audit_reviews; exception when duplicate_object then null; end $$;
