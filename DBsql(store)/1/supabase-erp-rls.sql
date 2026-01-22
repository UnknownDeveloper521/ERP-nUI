-- ERP RLS + Roles (Option B)
-- Run this in Supabase SQL editor (as a project owner).

begin;

-- =========================
-- Roles
-- =========================

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('Admin','Manager','Operator','Accountant','Supervisor','Quality Control')),
  created_at timestamptz default now()
);

alter table public.user_roles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'Admin'
  );
$$;

-- user_roles policies

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own
on public.user_roles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_roles_admin_all on public.user_roles;
create policy user_roles_admin_all
on public.user_roles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- =========================
-- Helper macro: common policies
-- =========================

-- MASTER TABLES: only Admin can write; authenticated can read

-- vendors_master
alter table if exists public.vendors_master enable row level security;

drop policy if exists vendors_master_read on public.vendors_master;
create policy vendors_master_read
on public.vendors_master
for select
to authenticated
using (true);

drop policy if exists vendors_master_admin_write on public.vendors_master;
create policy vendors_master_admin_write
on public.vendors_master
for insert
to authenticated
with check (public.is_admin());

drop policy if exists vendors_master_admin_update on public.vendors_master;
create policy vendors_master_admin_update
on public.vendors_master
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists vendors_master_admin_delete on public.vendors_master;
create policy vendors_master_admin_delete
on public.vendors_master
for delete
to authenticated
using (public.is_admin());

-- warehouses_master
alter table if exists public.warehouses_master enable row level security;

drop policy if exists warehouses_master_read on public.warehouses_master;
create policy warehouses_master_read
on public.warehouses_master
for select
to authenticated
using (true);

drop policy if exists warehouses_master_admin_write on public.warehouses_master;
create policy warehouses_master_admin_write
on public.warehouses_master
for insert
to authenticated
with check (public.is_admin());

drop policy if exists warehouses_master_admin_update on public.warehouses_master;
create policy warehouses_master_admin_update
on public.warehouses_master
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists warehouses_master_admin_delete on public.warehouses_master;
create policy warehouses_master_admin_delete
on public.warehouses_master
for delete
to authenticated
using (public.is_admin());

-- machine_master
alter table if exists public.machine_master enable row level security;

drop policy if exists machine_master_read on public.machine_master;
create policy machine_master_read
on public.machine_master
for select
to authenticated
using (true);

drop policy if exists machine_master_admin_write on public.machine_master;
create policy machine_master_admin_write
on public.machine_master
for insert
to authenticated
with check (public.is_admin());

drop policy if exists machine_master_admin_update on public.machine_master;
create policy machine_master_admin_update
on public.machine_master
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists machine_master_admin_delete on public.machine_master;
create policy machine_master_admin_delete
on public.machine_master
for delete
to authenticated
using (public.is_admin());

-- raw_material_master
alter table if exists public.raw_material_master enable row level security;

drop policy if exists raw_material_master_read on public.raw_material_master;
create policy raw_material_master_read
on public.raw_material_master
for select
to authenticated
using (true);

drop policy if exists raw_material_master_admin_write on public.raw_material_master;
create policy raw_material_master_admin_write
on public.raw_material_master
for insert
to authenticated
with check (public.is_admin());

drop policy if exists raw_material_master_admin_update on public.raw_material_master;
create policy raw_material_master_admin_update
on public.raw_material_master
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists raw_material_master_admin_delete on public.raw_material_master;
create policy raw_material_master_admin_delete
on public.raw_material_master
for delete
to authenticated
using (public.is_admin());

-- products_master
alter table if exists public.products_master enable row level security;

drop policy if exists products_master_read on public.products_master;
create policy products_master_read
on public.products_master
for select
to authenticated
using (true);

drop policy if exists products_master_admin_write on public.products_master;
create policy products_master_admin_write
on public.products_master
for insert
to authenticated
with check (public.is_admin());

drop policy if exists products_master_admin_update on public.products_master;
create policy products_master_admin_update
on public.products_master
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists products_master_admin_delete on public.products_master;
create policy products_master_admin_delete
on public.products_master
for delete
to authenticated
using (public.is_admin());

-- =========================
-- Operational tables: authenticated can read/write
-- =========================

-- raw_material_receipts
alter table if exists public.raw_material_receipts enable row level security;

drop policy if exists raw_material_receipts_rw on public.raw_material_receipts;
create policy raw_material_receipts_rw
on public.raw_material_receipts
for all
to authenticated
using (true)
with check (true);

-- raw_material_issues
alter table if exists public.raw_material_issues enable row level security;

drop policy if exists raw_material_issues_rw on public.raw_material_issues;
create policy raw_material_issues_rw
on public.raw_material_issues
for all
to authenticated
using (true)
with check (true);

-- raw_material_stock
alter table if exists public.raw_material_stock enable row level security;

drop policy if exists raw_material_stock_rw on public.raw_material_stock;
create policy raw_material_stock_rw
on public.raw_material_stock
for all
to authenticated
using (true)
with check (true);

-- raw_material_ledger
alter table if exists public.raw_material_ledger enable row level security;

drop policy if exists raw_material_ledger_rw on public.raw_material_ledger;
create policy raw_material_ledger_rw
on public.raw_material_ledger
for all
to authenticated
using (true)
with check (true);

-- stock_adjustments
alter table if exists public.stock_adjustments enable row level security;

drop policy if exists stock_adjustments_rw on public.stock_adjustments;
create policy stock_adjustments_rw
on public.stock_adjustments
for all
to authenticated
using (true)
with check (true);

-- inventory_thresholds
alter table if exists public.inventory_thresholds enable row level security;

drop policy if exists inventory_thresholds_rw on public.inventory_thresholds;
create policy inventory_thresholds_rw
on public.inventory_thresholds
for all
to authenticated
using (true)
with check (true);

-- production_batches
alter table if exists public.production_batches enable row level security;

drop policy if exists production_batches_rw on public.production_batches;
create policy production_batches_rw
on public.production_batches
for all
to authenticated
using (true)
with check (true);

-- production_entries
alter table if exists public.production_entries enable row level security;

drop policy if exists production_entries_rw on public.production_entries;
create policy production_entries_rw
on public.production_entries
for all
to authenticated
using (true)
with check (true);

-- production_quality_checks
alter table if exists public.production_quality_checks enable row level security;

drop policy if exists production_quality_checks_rw on public.production_quality_checks;
create policy production_quality_checks_rw
on public.production_quality_checks
for all
to authenticated
using (true)
with check (true);

-- production_waste_logs
alter table if exists public.production_waste_logs enable row level security;

drop policy if exists production_waste_logs_rw on public.production_waste_logs;
create policy production_waste_logs_rw
on public.production_waste_logs
for all
to authenticated
using (true)
with check (true);

-- machine_performance_logs
alter table if exists public.machine_performance_logs enable row level security;

drop policy if exists machine_performance_logs_rw on public.machine_performance_logs;
create policy machine_performance_logs_rw
on public.machine_performance_logs
for all
to authenticated
using (true)
with check (true);

-- shift_summaries
alter table if exists public.shift_summaries enable row level security;

drop policy if exists shift_summaries_rw on public.shift_summaries;
create policy shift_summaries_rw
on public.shift_summaries
for all
to authenticated
using (true)
with check (true);

-- fg_stock
alter table if exists public.fg_stock enable row level security;

drop policy if exists fg_stock_rw on public.fg_stock;
create policy fg_stock_rw
on public.fg_stock
for all
to authenticated
using (true)
with check (true);

commit;
