create type public.analytics_period as enum ('7_days','30_days','90_days','6_months','12_months','year_to_date','all_time');
create type public.report_status as enum ('draft','ready','archived');

create table public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  snapshot_date date not null default current_date,
  metrics jsonb not null default '{}'::jsonb,
  dimensions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(company_id,snapshot_date)
);

create table public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  name text not null,
  description text,
  period public.analytics_period not null default '30_days',
  status public.report_status not null default 'draft',
  configuration jsonb not null default '{}'::jsonb,
  generated_snapshot jsonb not null default '{}'::jsonb,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  widget_type text not null,
  title text not null,
  position integer not null default 0,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index analytics_snapshots_company_date_idx on public.analytics_snapshots(company_id,snapshot_date desc);
create index saved_reports_company_idx on public.saved_reports(company_id,updated_at desc);
create index dashboard_widgets_user_idx on public.dashboard_widgets(company_id,user_id,position);

create trigger saved_reports_touch before update on public.saved_reports for each row execute function public.touch_updated_at();
create trigger dashboard_widgets_touch before update on public.dashboard_widgets for each row execute function public.touch_updated_at();

alter table public.analytics_snapshots enable row level security;
alter table public.saved_reports enable row level security;
alter table public.dashboard_widgets enable row level security;

create policy analytics_snapshots_read on public.analytics_snapshots for select using (public.is_company_member(company_id));
create policy analytics_snapshots_write on public.analytics_snapshots for all using (public.can_edit_company_data(company_id)) with check (public.can_edit_company_data(company_id));
create policy saved_reports_read on public.saved_reports for select using (public.is_company_member(company_id));
create policy saved_reports_write on public.saved_reports for all using (public.can_edit_company_data(company_id)) with check (created_by=auth.uid() and public.can_edit_company_data(company_id));
create policy dashboard_widgets_owner on public.dashboard_widgets for all using (user_id=auth.uid() and public.is_company_member(company_id)) with check (user_id=auth.uid() and public.is_company_member(company_id));

do $$ begin alter publication supabase_realtime add table public.analytics_snapshots; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.saved_reports; exception when duplicate_object then null; end $$;
