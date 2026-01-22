-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.accounts (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  account_code text NOT NULL UNIQUE,
  account_name text NOT NULL,
  account_type text NOT NULL,
  parent_account_id character varying,
  balance numeric DEFAULT '0'::numeric,
  status text DEFAULT 'active'::text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT accounts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.applications (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  job_posting_id character varying NOT NULL,
  candidate_name text NOT NULL,
  email text NOT NULL,
  phone text,
  resume text,
  cover_letter text,
  status text DEFAULT 'applied'::text,
  applied_date date DEFAULT now(),
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT applications_pkey PRIMARY KEY (id)
);
CREATE TABLE public.attendance (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  employee_id character varying NOT NULL,
  date date NOT NULL,
  check_in timestamp without time zone,
  check_out timestamp without time zone,
  status text DEFAULT 'present'::text,
  notes text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT attendance_pkey PRIMARY KEY (id)
);
CREATE TABLE public.chat_members (
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone,
  CONSTRAINT chat_members_pkey PRIMARY KEY (room_id, user_id),
  CONSTRAINT chat_members_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id),
  CONSTRAINT chat_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.chat_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type = ANY (ARRAY['private'::text, 'group'::text])),
  title text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_rooms_pkey PRIMARY KEY (id),
  CONSTRAINT chat_rooms_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.customers (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  company text,
  address text,
  city text,
  state text,
  country text,
  postal_code text,
  status text DEFAULT 'active'::text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.departments (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  head_id character varying,
  status text DEFAULT 'active'::text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.employees (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  employee_id text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  date_of_birth date,
  date_of_joining date,
  department_id character varying,
  designation text,
  reporting_to character varying,
  employment_type text,
  status text DEFAULT 'active'::text,
  address text,
  city text,
  state text,
  country text,
  postal_code text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT employees_pkey PRIMARY KEY (id)
);
CREATE TABLE public.fg_stock (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  product_id uuid,
  production_batch_no text,
  machine_id uuid,
  produced_qty numeric NOT NULL,
  produced_weight numeric,
  available_qty numeric NOT NULL,
  warehouse_id uuid,
  unit_cost numeric,
  total_cost numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fg_stock_pkey PRIMARY KEY (id),
  CONSTRAINT fg_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products_master(id),
  CONSTRAINT fg_stock_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machine_master(id),
  CONSTRAINT fg_stock_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses_master(id)
);
CREATE TABLE public.inventory_thresholds (
  material_type text NOT NULL,
  material_id uuid NOT NULL,
  warehouse_location text NOT NULL,
  min_qty numeric DEFAULT 0,
  reorder_level numeric DEFAULT 0,
  max_qty numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  CONSTRAINT inventory_thresholds_pkey PRIMARY KEY (id)
);
CREATE TABLE public.job_postings (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department_id character varying,
  description text,
  requirements text,
  location text,
  employment_type text,
  salary_range text,
  status text DEFAULT 'open'::text,
  openings integer DEFAULT 1,
  posted_date date DEFAULT now(),
  closing_date date,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT job_postings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.leads (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  company text,
  source text,
  status text DEFAULT 'new'::text,
  assigned_to character varying,
  notes text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT leads_pkey PRIMARY KEY (id)
);
CREATE TABLE public.leaves (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  employee_id character varying NOT NULL,
  leave_type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days integer NOT NULL,
  reason text,
  status text DEFAULT 'pending'::text,
  approved_by character varying,
  approved_at timestamp without time zone,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT leaves_pkey PRIMARY KEY (id)
);
CREATE TABLE public.machine_master (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  machine_type text,
  classification text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT machine_master_pkey PRIMARY KEY (id)
);
CREATE TABLE public.machine_performance_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  machine_id uuid,
  runtime_min numeric,
  downtime_min numeric,
  cycles numeric,
  log_date date,
  CONSTRAINT machine_performance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT machine_performance_logs_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machine_master(id)
);
CREATE TABLE public.message_reads (
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_reads_pkey PRIMARY KEY (message_id, user_id),
  CONSTRAINT message_reads_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id),
  CONSTRAINT message_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text,
  file_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  seen boolean NOT NULL DEFAULT false,
  seen_at timestamp with time zone,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id)
);
CREATE TABLE public.opportunities (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  customer_id character varying,
  lead_id character varying,
  value numeric,
  stage text DEFAULT 'prospecting'::text,
  probability integer,
  expected_close_date date,
  assigned_to character varying,
  status text DEFAULT 'open'::text,
  notes text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT opportunities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.packaging_material_master (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  packaging_type text,
  material text,
  product_id uuid,
  weight_per_unit numeric,
  batch_weight numeric,
  vendor_id uuid,
  purchase_order_no text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT packaging_material_master_pkey PRIMARY KEY (id),
  CONSTRAINT packaging_material_master_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products_master(id),
  CONSTRAINT packaging_material_master_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors_master(id)
);
CREATE TABLE public.payroll (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  employee_id character varying NOT NULL,
  month text NOT NULL,
  year integer NOT NULL,
  basic_salary numeric,
  allowances numeric,
  deductions numeric,
  net_salary numeric,
  status text DEFAULT 'draft'::text,
  processed_at timestamp without time zone,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT payroll_pkey PRIMARY KEY (id)
);
CREATE TABLE public.production_batch_records (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  batch_id uuid NOT NULL,
  batch_no text,
  batch_date date,
  shift text,
  machine_id uuid,
  operator_id uuid,
  fg_product_id uuid,
  roll_material_id uuid,
  packaging_material_id uuid,
  rm_roll_qty numeric,
  rm_packaging_qty numeric,
  status text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  remarks text,
  source_created_at timestamp with time zone,
  source_updated_at timestamp with time zone,
  operation text NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT production_batch_records_pkey PRIMARY KEY (id)
);
CREATE TABLE public.production_batches (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  batch_no text NOT NULL UNIQUE,
  product_id uuid,
  machine_id uuid,
  shift text,
  planned_qty numeric,
  actual_qty numeric,
  status text DEFAULT 'Running'::text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp without time zone DEFAULT now(),
  batch_date date NOT NULL DEFAULT CURRENT_DATE,
  operator_id uuid,
  roll_material_id uuid,
  packaging_material_id uuid,
  rm_roll_qty numeric NOT NULL DEFAULT 0,
  rm_packaging_qty numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT production_batches_pkey PRIMARY KEY (id),
  CONSTRAINT production_batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products_master(id),
  CONSTRAINT production_batches_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machine_master(id),
  CONSTRAINT production_batches_roll_material_id_fkey FOREIGN KEY (roll_material_id) REFERENCES public.raw_material_roll_master(id),
  CONSTRAINT production_batches_packaging_material_id_fkey FOREIGN KEY (packaging_material_id) REFERENCES public.packaging_material_master(id),
  CONSTRAINT production_batches_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES auth.users(id)
);
CREATE TABLE public.production_entries (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  batch_id uuid,
  entry_time timestamp with time zone DEFAULT now(),
  operator_name text,
  produced_qty numeric,
  status text,
  rm_issue_id uuid,
  CONSTRAINT production_entries_pkey PRIMARY KEY (id),
  CONSTRAINT production_entries_batch_fk FOREIGN KEY (batch_id) REFERENCES public.production_batches(id)
);
CREATE TABLE public.production_quality_checks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  batch_id uuid,
  sample_size integer,
  passed_qty integer,
  failed_qty integer,
  inspector text,
  result text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT production_quality_checks_pkey PRIMARY KEY (id),
  CONSTRAINT production_quality_checks_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.production_batches(id)
);
CREATE TABLE public.production_waste_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  batch_id uuid,
  material_id uuid,
  waste_qty numeric,
  waste_reason text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT production_waste_logs_pkey PRIMARY KEY (id),
  CONSTRAINT production_waste_logs_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.production_batches(id),
  CONSTRAINT production_waste_logs_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.raw_material_master(id)
);
CREATE TABLE public.products (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text,
  unit text,
  purchase_price numeric,
  selling_price numeric,
  current_stock integer DEFAULT 0,
  min_stock integer DEFAULT 0,
  max_stock integer,
  status text DEFAULT 'active'::text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.products_master (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  product_code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text,
  type text,
  grade text,
  gsm numeric,
  ply integer,
  avg_weight numeric,
  packaging_sizes jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT products_master_pkey PRIMARY KEY (id)
);
CREATE TABLE public.purchase_order_items (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  purchase_order_id character varying NOT NULL,
  product_id character varying NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric,
  total numeric,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.purchase_orders (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  supplier_id character varying NOT NULL,
  order_date date DEFAULT now(),
  expected_delivery_date date,
  status text DEFAULT 'draft'::text,
  subtotal numeric,
  tax numeric,
  total numeric,
  notes text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (id)
);
CREATE TABLE public.raw_material_issues (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  issue_no text NOT NULL UNIQUE,
  receipt_id uuid,
  material_type text CHECK (material_type = ANY (ARRAY['ROLL'::text, 'PACKAGING'::text])),
  roll_material_id uuid,
  packaging_material_id uuid,
  warehouse_location text NOT NULL,
  batch_id uuid,
  machine_id uuid,
  issued_qty numeric NOT NULL,
  issued_cost numeric,
  issued_date timestamp with time zone DEFAULT now(),
  issued_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT raw_material_issues_pkey PRIMARY KEY (id),
  CONSTRAINT raw_material_issues_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.raw_material_receipts(id),
  CONSTRAINT raw_material_issues_roll_material_id_fkey FOREIGN KEY (roll_material_id) REFERENCES public.raw_material_roll_master(id),
  CONSTRAINT raw_material_issues_packaging_material_id_fkey FOREIGN KEY (packaging_material_id) REFERENCES public.packaging_material_master(id),
  CONSTRAINT raw_material_issues_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.production_batches(id),
  CONSTRAINT raw_material_issues_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machine_master(id)
);
CREATE TABLE public.raw_material_ledger (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  material_type text,
  roll_material_id uuid,
  packaging_material_id uuid,
  txn_type text,
  reference_id uuid,
  qty_in numeric DEFAULT 0,
  qty_out numeric DEFAULT 0,
  balance_after numeric,
  txn_date timestamp with time zone DEFAULT now(),
  CONSTRAINT raw_material_ledger_pkey PRIMARY KEY (id)
);
CREATE TABLE public.raw_material_master (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  material_code text NOT NULL UNIQUE,
  name text NOT NULL,
  material_type text,
  gsm numeric,
  ply integer,
  width_mm numeric,
  grade text,
  uom text NOT NULL DEFAULT 'KG'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT raw_material_master_pkey PRIMARY KEY (id)
);
CREATE TABLE public.raw_material_receipts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  receipt_no text NOT NULL UNIQUE,
  vendor_id uuid,
  purchase_order_no text,
  supplier_invoice_no text,
  lot_no text,
  container_no text,
  received_date date NOT NULL,
  gross_qty numeric NOT NULL,
  qc_passed_qty numeric NOT NULL,
  rejected_qty numeric DEFAULT 0,
  unit_cost numeric NOT NULL,
  total_cost numeric,
  warehouse_location text DEFAULT 'MAIN'::text,
  qc_status text DEFAULT 'Pending'::text,
  remarks text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  material_type text CHECK (material_type = ANY (ARRAY['ROLL'::text, 'PACKAGING'::text])),
  roll_material_id uuid,
  packaging_material_id uuid,
  warehouse_id uuid,
  CONSTRAINT raw_material_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT raw_material_receipts_roll_material_id_fkey FOREIGN KEY (roll_material_id) REFERENCES public.raw_material_roll_master(id),
  CONSTRAINT raw_material_receipts_packaging_material_id_fkey FOREIGN KEY (packaging_material_id) REFERENCES public.packaging_material_master(id),
  CONSTRAINT raw_material_receipts_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses_master(id)
);
CREATE TABLE public.raw_material_roll_master (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  gsm numeric,
  ply integer,
  width_mm numeric,
  grade text,
  product_id uuid,
  weight_kg numeric NOT NULL,
  vendor_id uuid,
  purchase_order_no text,
  lot_no text,
  container_no text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT raw_material_roll_master_pkey PRIMARY KEY (id),
  CONSTRAINT raw_material_roll_master_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products_master(id),
  CONSTRAINT raw_material_roll_master_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors_master(id)
);
CREATE TABLE public.raw_material_stock (
  material_type text NOT NULL CHECK (material_type = ANY (ARRAY['ROLL'::text, 'PACKAGING'::text])),
  roll_material_id uuid,
  packaging_material_id uuid,
  warehouse_location text NOT NULL,
  available_qty numeric DEFAULT 0,
  last_updated timestamp with time zone DEFAULT now(),
  material_key uuid NOT NULL DEFAULT COALESCE(roll_material_id, packaging_material_id),
  CONSTRAINT raw_material_stock_pkey PRIMARY KEY (material_type, material_key, warehouse_location)
);
CREATE TABLE public.sales_order_items (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  sales_order_id character varying NOT NULL,
  product_id character varying NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric,
  total numeric,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT sales_order_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sales_orders (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_id character varying NOT NULL,
  order_date date DEFAULT now(),
  expected_delivery_date date,
  status text DEFAULT 'draft'::text,
  subtotal numeric,
  tax numeric,
  total numeric,
  notes text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT sales_orders_pkey PRIMARY KEY (id)
);
CREATE TABLE public.shift_summaries (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  shift text,
  machine_id uuid,
  planned_qty numeric,
  actual_qty numeric,
  downtime_min numeric,
  remarks text,
  log_date date,
  CONSTRAINT shift_summaries_pkey PRIMARY KEY (id),
  CONSTRAINT shift_summaries_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machine_master(id)
);
CREATE TABLE public.stock_adjustments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  material_type text NOT NULL CHECK (material_type = ANY (ARRAY['ROLL'::text, 'PACKAGING'::text])),
  roll_material_id uuid,
  packaging_material_id uuid,
  qty_change numeric NOT NULL,
  reason text,
  approved_by uuid,
  warehouse_location text DEFAULT 'MAIN'::text,
  created_at timestamp with time zone DEFAULT now(),
  adj_type text CHECK (adj_type = ANY (ARRAY['ADD'::text, 'REDUCE'::text, 'IN'::text, 'OUT'::text])),
  warehouse_id uuid,
  CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id),
  CONSTRAINT stock_adjustments_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses_master(id),
  CONSTRAINT stock_adjustments_roll_material_id_fkey FOREIGN KEY (roll_material_id) REFERENCES public.raw_material_roll_master(id),
  CONSTRAINT stock_adjustments_packaging_material_id_fkey FOREIGN KEY (packaging_material_id) REFERENCES public.packaging_material_master(id)
);
CREATE TABLE public.stock_alert_log (
  id uuid DEFAULT uuid_generate_v4(),
  material_type text,
  material_id uuid,
  warehouse_location text,
  available_qty numeric,
  alert_status text,
  checked_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.stock_movements (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  product_id character varying NOT NULL,
  movement_type text NOT NULL,
  quantity integer NOT NULL,
  reference_type text,
  reference_id character varying,
  notes text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT stock_movements_pkey PRIMARY KEY (id)
);
CREATE TABLE public.suppliers (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  company text,
  address text,
  city text,
  state text,
  country text,
  postal_code text,
  status text DEFAULT 'active'::text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT suppliers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.transactions (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  transaction_date date DEFAULT now(),
  account_id character varying NOT NULL,
  type text NOT NULL,
  amount numeric NOT NULL,
  description text,
  reference_type text,
  reference_id character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.trips (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  trip_number text NOT NULL UNIQUE,
  vehicle_id character varying NOT NULL,
  driver_id character varying,
  origin text,
  destination text,
  start_date timestamp without time zone,
  end_date timestamp without time zone,
  status text DEFAULT 'planned'::text,
  distance numeric,
  notes text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT trips_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['Admin'::text, 'Manager'::text, 'Operator'::text, 'Accountant'::text, 'Supervisor'::text, 'Quality Control'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.users (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  email text,
  role text DEFAULT 'user'::text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users_profile (
  id uuid NOT NULL,
  name text NOT NULL,
  department text,
  role text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT users_profile_pkey PRIMARY KEY (id),
  CONSTRAINT users_profile_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.vehicles (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  vehicle_number text NOT NULL UNIQUE,
  vehicle_type text,
  capacity numeric,
  status text DEFAULT 'available'::text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT vehicles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.vendors_master (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vendors_master_pkey PRIMARY KEY (id)
);
CREATE TABLE public.warehouses_master (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text,
  location text,
  is_main boolean DEFAULT false,
  CONSTRAINT warehouses_master_pkey PRIMARY KEY (id)
);