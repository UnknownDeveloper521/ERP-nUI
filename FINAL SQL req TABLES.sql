
-- Raw Material Roll Master -- RAW MATERIAL ROLL MASTER (Master of every roll)
CREATE TABLE raw_material_roll_master (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  name text NOT NULL,
  gsm numeric,
  ply int,
  width_mm numeric,
  grade text,

  product_id uuid REFERENCES products_master(id),  -- Which product this roll makes
  weight_kg numeric NOT NULL,

  vendor_id uuid REFERENCES vendors_master(id),
  purchase_order_no text,
  lot_no text,
  container_no text,

  created_at timestamptz DEFAULT now()
);

-- Packaging Material Master -- PACKAGING MATERIAL MASTER (Master of every packaging material)
CREATE TABLE packaging_material_master (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  name text NOT NULL,
  packaging_type text,
  material text,
  product_id uuid REFERENCES products_master(id),

  weight_per_unit numeric,
  batch_weight numeric,

  vendor_id uuid REFERENCES vendors_master(id),
  purchase_order_no text,

  created_at timestamptz DEFAULT now()
);

CREATE TABLE vendors_master (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  created_at timestamptz DEFAULT now()
);

-- Warehouses Master -- WAREHOUSES MASTER (Master of every warehouse)
CREATE TABLE warehouses_master (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text,
  location text,
  is_main boolean DEFAULT false
);

-- Machines Master -- MACHINES MASTER (Master of every machine)
CREATE TABLE machine_master (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  machine_type text,      -- Roll / Fold / Pack
  classification text,    -- Auto / Manual
  created_at timestamptz DEFAULT now()
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



-- /////////// Transaction Tables ///////////
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
  CONSTRAINT raw_material_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT raw_material_receipts_roll_material_id_fkey FOREIGN KEY (roll_material_id) REFERENCES public.raw_material_roll_master(id),
  CONSTRAINT raw_material_receipts_packaging_material_id_fkey FOREIGN KEY (packaging_material_id) REFERENCES public.packaging_material_master(id)
);


CREATE TABLE public.raw_material_issues (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  issue_no text NOT NULL UNIQUE,
  receipt_id uuid,
  material_type text CHECK (material_type = ANY (ARRAY['ROLL'::text, 'PACKAGING'::text])),
  roll_material_id uuid,
  packaging_material_id uuid,
  machine_id uuid,
  batch_id uuid,
  issued_qty numeric NOT NULL,
  issued_cost numeric,
  issued_date date NOT NULL,
  issued_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT raw_material_issues_pkey PRIMARY KEY (id),
  CONSTRAINT raw_material_issues_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.raw_material_receipts(id),
  CONSTRAINT raw_material_issues_roll_material_id_fkey FOREIGN KEY (roll_material_id) REFERENCES public.raw_material_roll_master(id),
  CONSTRAINT raw_material_issues_packaging_material_id_fkey FOREIGN KEY (packaging_material_id) REFERENCES public.packaging_material_master(id),
  CONSTRAINT raw_material_issues_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machine_master(id),
  CONSTRAINT raw_material_issues_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.production_batches(id)
);

CREATE TABLE public.stock_adjustments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  material_id uuid,
  adj_type text,
  qty_change numeric,
  reason text,
  approved_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id),
  CONSTRAINT stock_adjustments_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.raw_material_master(id)
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
  CONSTRAINT production_batches_pkey PRIMARY KEY (id),
  CONSTRAINT production_batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products_master(id),
  CONSTRAINT production_batches_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machine_master(id)
);


-- ///////// other Tables /////////

CREATE TABLE public.raw_material_stock (
  material_type text NOT NULL CHECK (material_type = ANY (ARRAY['ROLL'::text, 'PACKAGING'::text])),
  roll_material_id uuid NOT NULL,
  packaging_material_id uuid NOT NULL,
  warehouse_location text NOT NULL,
  available_qty numeric DEFAULT 0,
  last_updated timestamp with time zone DEFAULT now(),
  CONSTRAINT raw_material_stock_pkey PRIMARY KEY (material_type, roll_material_id, packaging_material_id, warehouse_location)
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

CREATE TABLE public.inventory_thresholds (
  material_id uuid NOT NULL,
  min_qty numeric DEFAULT 0,
  reorder_level numeric DEFAULT 0,
  max_qty numeric DEFAULT 0,
  CONSTRAINT inventory_thresholds_pkey PRIMARY KEY (material_id),
  CONSTRAINT inventory_thresholds_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.raw_material_master(id)
);




-- /////////// Fuctions and Triggers ///////////

-- Calculate total cost
CREATE OR REPLACE FUNCTION fn_calc_total_cost()
RETURNS trigger AS $$
BEGIN
  NEW.total_cost := NEW.qc_passed_qty * NEW.unit_cost;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_total_value ON raw_material_receipts;

CREATE TRIGGER trg_calc_total_cost
BEFORE INSERT OR UPDATE ON raw_material_receipts
FOR EACH ROW EXECUTE FUNCTION fn_calc_total_cost();

-- Post receipt to stock
CREATE OR REPLACE FUNCTION fn_post_receipt_to_stock()
RETURNS trigger AS $$
DECLARE current_balance numeric;
DECLARE mkey uuid;
BEGIN
  mkey := COALESCE(NEW.roll_material_id, NEW.packaging_material_id);

  INSERT INTO raw_material_stock(
    material_type,
    roll_material_id,
    packaging_material_id,
    warehouse_location,
    available_qty,
    last_updated
  )
  VALUES(
    NEW.material_type,
    NEW.roll_material_id,
    NEW.packaging_material_id,
    NEW.warehouse_location,
    NEW.qc_passed_qty,
    now()
  )
  ON CONFLICT (material_type, material_key, warehouse_location)
  DO UPDATE SET
    available_qty = raw_material_stock.available_qty + EXCLUDED.available_qty,
    last_updated = now();

  SELECT available_qty INTO current_balance
  FROM raw_material_stock
  WHERE material_type = NEW.material_type
    AND material_key = mkey
    AND warehouse_location = NEW.warehouse_location;

  INSERT INTO raw_material_ledger(
    material_type, roll_material_id, packaging_material_id,
    txn_type, reference_id, qty_in, balance_after
  )
  VALUES(
    NEW.material_type, NEW.roll_material_id, NEW.packaging_material_id,
    'RECEIPT', NEW.id, NEW.qc_passed_qty, current_balance
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_receipt
AFTER INSERT ON raw_material_receipts
FOR EACH ROW EXECUTE FUNCTION fn_post_receipt_to_stock();


-- Apply stock adjustment
CREATE OR REPLACE FUNCTION fn_apply_adjustment()
RETURNS trigger AS $$
DECLARE new_balance numeric;
BEGIN
  UPDATE raw_material_stock
  SET available_qty = available_qty + NEW.qty_change,
      last_updated = now()
  WHERE material_id = NEW.material_id;

  SELECT available_qty INTO new_balance FROM raw_material_stock WHERE material_id = NEW.material_id;

  INSERT INTO raw_material_ledger(material_id, txn_type, reference_id, 
                                  qty_in, qty_out, balance_after)
  VALUES(NEW.material_id, 'ADJUSTMENT', NEW.id,
         CASE WHEN NEW.qty_change > 0 THEN NEW.qty_change ELSE 0 END,
         CASE WHEN NEW.qty_change < 0 THEN abs(NEW.qty_change) ELSE 0 END,
         new_balance);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_adjustment
AFTER INSERT ON stock_adjustments
FOR EACH ROW EXECUTE FUNCTION fn_apply_adjustment();