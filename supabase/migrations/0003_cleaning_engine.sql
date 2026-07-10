create type public.cleaning_job_status as enum ('draft','mapped','processing','review','approved','failed');
create type public.cleaning_issue_severity as enum ('info','warning','error');
create type public.cleaning_issue_status as enum ('open','accepted','ignored','fixed');

create table public.cleaning_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  name text not null,
  source_filename text not null,
  status public.cleaning_job_status not null default 'draft',
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  source_headers text[] not null default '{}',
  field_mapping jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.cleaning_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  field text not null,
  rule_type text not null check (rule_type in ('trim','remove_extra_spaces','uppercase','lowercase','titlecase','normalize_sku','normalize_barcode','coerce_number','default_value')),
  configuration jsonb not null default '{}'::jsonb,
  priority integer not null default 100,
  enabled boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cleaning_staged_rows (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  cleaning_job_id uuid not null references public.cleaning_jobs(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  mapped_data jsonb not null default '{}'::jsonb,
  cleaned_data jsonb not null default '{}'::jsonb,
  validation_errors text[] not null default '{}',
  is_valid boolean not null default false,
  is_duplicate boolean not null default false,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cleaning_job_id,row_number)
);

create table public.cleaning_issues (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  cleaning_job_id uuid not null references public.cleaning_jobs(id) on delete cascade,
  staged_row_id uuid references public.cleaning_staged_rows(id) on delete cascade,
  severity public.cleaning_issue_severity not null default 'warning',
  status public.cleaning_issue_status not null default 'open',
  issue_type text not null,
  field text,
  message text not null,
  raw_value jsonb,
  suggested_value jsonb,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.cleaning_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  cleaning_job_id uuid not null references public.cleaning_jobs(id) on delete cascade,
  staged_row_id uuid not null references public.cleaning_staged_rows(id) on delete cascade,
  existing_product_id uuid references public.products(id) on delete cascade,
  duplicate_staged_row_id uuid references public.cleaning_staged_rows(id) on delete cascade,
  score numeric(5,4) not null check (score between 0 and 1),
  reasons text[] not null default '{}',
  resolution text check (resolution in ('merge','keep_both','replace','ignore')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check ((existing_product_id is not null) <> (duplicate_staged_row_id is not null))
);

create index cleaning_jobs_company_created_idx on public.cleaning_jobs(company_id,created_at desc);
create index cleaning_rows_job_number_idx on public.cleaning_staged_rows(cleaning_job_id,row_number);
create index cleaning_rows_review_idx on public.cleaning_staged_rows(cleaning_job_id,is_valid,is_duplicate,approved);
create index cleaning_issues_job_status_idx on public.cleaning_issues(cleaning_job_id,status,severity);
create index cleaning_duplicates_job_idx on public.cleaning_duplicate_candidates(cleaning_job_id,resolution);
create index cleaning_rules_company_priority_idx on public.cleaning_rules(company_id,priority);

create trigger cleaning_jobs_touch before update on public.cleaning_jobs for each row execute function public.touch_updated_at();
create trigger cleaning_rules_touch before update on public.cleaning_rules for each row execute function public.touch_updated_at();
create trigger cleaning_rows_touch before update on public.cleaning_staged_rows for each row execute function public.touch_updated_at();

alter table public.cleaning_jobs enable row level security;
alter table public.cleaning_rules enable row level security;
alter table public.cleaning_staged_rows enable row level security;
alter table public.cleaning_issues enable row level security;
alter table public.cleaning_duplicate_candidates enable row level security;

create policy cleaning_jobs_read on public.cleaning_jobs for select using (public.is_company_member(company_id));
create policy cleaning_jobs_write on public.cleaning_jobs for insert with check (created_by=auth.uid() and public.can_edit_company_data(company_id));
create policy cleaning_jobs_update on public.cleaning_jobs for update using (public.can_edit_company_data(company_id)) with check (public.can_edit_company_data(company_id));
create policy cleaning_jobs_delete on public.cleaning_jobs for delete using (public.can_manage_company(company_id));

create policy cleaning_rules_read on public.cleaning_rules for select using (public.is_company_member(company_id));
create policy cleaning_rules_write on public.cleaning_rules for all using (public.can_edit_company_data(company_id)) with check (public.can_edit_company_data(company_id));

create policy cleaning_rows_read on public.cleaning_staged_rows for select using (public.is_company_member(company_id));
create policy cleaning_rows_write on public.cleaning_staged_rows for all using (public.can_edit_company_data(company_id)) with check (public.can_edit_company_data(company_id));

create policy cleaning_issues_read on public.cleaning_issues for select using (public.is_company_member(company_id));
create policy cleaning_issues_write on public.cleaning_issues for all using (public.can_edit_company_data(company_id)) with check (public.can_edit_company_data(company_id));

create policy cleaning_duplicates_read on public.cleaning_duplicate_candidates for select using (public.is_company_member(company_id));
create policy cleaning_duplicates_write on public.cleaning_duplicate_candidates for all using (public.can_edit_company_data(company_id)) with check (public.can_edit_company_data(company_id));

do $$ begin alter publication supabase_realtime add table public.cleaning_jobs; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.cleaning_staged_rows; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.cleaning_issues; exception when duplicate_object then null; end $$;
