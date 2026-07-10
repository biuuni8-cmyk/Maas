create table public.saved_product_views (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  sorting jsonb not null default '[]'::jsonb,
  visible_columns text[] not null default array['sku','name','category','price','currency','quality_score','status'],
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,user_id,name)
);

create table public.product_imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  filename text not null,
  status text not null check (status in ('processing','completed','failed')),
  total_rows integer not null default 0,
  inserted_rows integer not null default 0,
  updated_rows integer not null default 0,
  failed_rows integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.product_change_history (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  operation text not null check (operation in ('insert','update','delete')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index saved_product_views_lookup_idx on public.saved_product_views(company_id,user_id);
create index product_imports_company_created_idx on public.product_imports(company_id,created_at desc);
create index product_history_product_created_idx on public.product_change_history(product_id,created_at desc);

create trigger saved_product_views_touch before update on public.saved_product_views for each row execute function public.touch_updated_at();

create or replace function public.log_product_change() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.product_change_history(company_id,product_id,actor_id,operation,after_data)
    values(new.company_id,new.id,auth.uid(),'insert',to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.product_change_history(company_id,product_id,actor_id,operation,before_data,after_data)
    values(new.company_id,new.id,auth.uid(),'update',to_jsonb(old),to_jsonb(new));
    return new;
  else
    insert into public.product_change_history(company_id,product_id,actor_id,operation,before_data)
    values(old.company_id,old.id,auth.uid(),'delete',to_jsonb(old));
    return old;
  end if;
end $$;

create trigger products_history after insert or update or delete on public.products
for each row execute function public.log_product_change();

alter table public.saved_product_views enable row level security;
alter table public.product_imports enable row level security;
alter table public.product_change_history enable row level security;

create policy saved_views_own_all on public.saved_product_views for all
using (user_id=auth.uid() and public.is_company_member(company_id))
with check (user_id=auth.uid() and public.is_company_member(company_id));
create policy product_imports_read on public.product_imports for select using (public.is_company_member(company_id));
create policy product_imports_write on public.product_imports for insert with check (created_by=auth.uid() and public.can_edit_company_data(company_id));
create policy product_imports_update on public.product_imports for update using (created_by=auth.uid() and public.can_edit_company_data(company_id));
create policy product_history_read on public.product_change_history for select using (public.is_company_member(company_id));

alter table public.products add column if not exists description text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists cost numeric(14,2);
alter table public.products add column if not exists stock_quantity numeric(16,3);
alter table public.products add column if not exists unit text;
alter table public.products add column if not exists tags text[] not null default '{}';

do $$ begin alter publication supabase_realtime add table public.saved_product_views; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.product_imports; exception when duplicate_object then null; end $$;
