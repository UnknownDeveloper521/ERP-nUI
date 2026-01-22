-- ****************** Master Tables *****************

-- Users Profile : Master table for users profile.
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


-- Warehouses : Master table for warehouses.
CREATE TABLE public.warehouses_master (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text,
  location text,
  is_main boolean DEFAULT false,
  CONSTRAINT warehouses_master_pkey PRIMARY KEY (id)
);

-- Vendors : Master table for vendors.
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

-- Machines : Master table for machines.
CREATE TABLE public.machine_master (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  machine_type text,
  classification text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT machine_master_pkey PRIMARY KEY (id)
);

-- Raw Material Roll : Master table for raw material rolls.
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

-- Packaging Material : Master table for packaging materials.
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


-- ********** Transaction Tables **********

-- Raw Material Receipts : Receipts of raw materials.
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


-- Raw Material Issues : Issues of raw materials to Production.
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


-- Production Batches : Batches of products.
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


-- Production Entries : Entries of products.
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

-- Stock Adjustments : Adjustments to raw material stock levels.
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



-- ************** Stock Tracking Tables **************

-- Raw Material Stock : Current stock levels of raw materials per warehouse.
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


-- Raw Material Ledger : Transaction history of raw materials.
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


-- Inventory Thresholds : Minimum and maximum stock levels for raw materials.
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





-- Triggers

-- Trigger to handle new auth user creation
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users_profile (id, name)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name',''), split_part(NEW.email, '@', 1), 'User')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();




-- Helper Function: Get Warehouse Name
CREATE OR REPLACE FUNCTION fn_get_warehouse_name(p_id uuid, p_fallback text)
RETURNS text AS $$
DECLARE
    v_name text;
BEGIN
    IF p_id IS NOT NULL THEN
        SELECT name INTO v_name FROM warehouses_master WHERE id = p_id;
    END IF;
    
    IF v_name IS NULL THEN
        v_name := p_fallback;
    END IF;

    IF v_name IS NULL THEN
        v_name := 'MAIN';
    END IF;

    RETURN v_name;
END;
$$ LANGUAGE plpgsql;

-- 1. Calculate Total Cost
CREATE OR REPLACE FUNCTION fn_calc_total_cost()
RETURNS trigger AS $$
BEGIN
  NEW.total_cost := NEW.qc_passed_qty * NEW.unit_cost;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_total_cost ON raw_material_receipts;
CREATE TRIGGER trg_calc_total_cost
BEFORE INSERT OR UPDATE ON raw_material_receipts
FOR EACH ROW EXECUTE FUNCTION fn_calc_total_cost();





-- 2. Post Receipt to Stock
CREATE OR REPLACE FUNCTION fn_post_receipt_to_stock()
RETURNS trigger AS $$
DECLARE 
  bal numeric;
  loc_name text;
BEGIN
  IF NEW.warehouse_id IS NOT NULL THEN
    SELECT name INTO loc_name FROM warehouses_master WHERE id = NEW.warehouse_id;
  ELSE
    loc_name := NEW.warehouse_location;
  END IF;

  IF loc_name IS NULL THEN
     loc_name := 'MAIN'; 
  END IF;
  
  NEW.warehouse_location := loc_name;

  INSERT INTO raw_material_stock(material_type, roll_material_id, packaging_material_id,
                                 warehouse_location, available_qty)
  VALUES (NEW.material_type, NEW.roll_material_id, NEW.packaging_material_id,
          loc_name, NEW.qc_passed_qty)
  ON CONFLICT (material_type, material_key, warehouse_location)
  DO UPDATE SET available_qty = raw_material_stock.available_qty + NEW.qc_passed_qty,
                last_updated = now();

  SELECT available_qty INTO bal
  FROM raw_material_stock
  WHERE material_type = NEW.material_type
    AND material_key = COALESCE(NEW.roll_material_id, NEW.packaging_material_id)
    AND warehouse_location = loc_name;

  INSERT INTO raw_material_ledger(material_type, roll_material_id, packaging_material_id,
                                  txn_type, reference_id, qty_in, balance_after)
  VALUES(NEW.material_type, NEW.roll_material_id, NEW.packaging_material_id,
         'RECEIPT', NEW.id, NEW.qc_passed_qty, bal);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_receipt ON raw_material_receipts;
CREATE TRIGGER trg_post_receipt
AFTER INSERT ON raw_material_receipts
FOR EACH ROW EXECUTE FUNCTION fn_post_receipt_to_stock();






-- 3. Post Receipt Update to Stock
CREATE OR REPLACE FUNCTION fn_post_receipt_update_to_stock()
RETURNS trigger AS $$
DECLARE
  old_key uuid;
  new_key uuid;
  old_bal numeric;
  new_bal numeric;
  
  v_old_loc text;
  v_new_loc text;
BEGIN
  old_key := COALESCE(OLD.roll_material_id, OLD.packaging_material_id);
  new_key := COALESCE(NEW.roll_material_id, NEW.packaging_material_id);

  v_old_loc := fn_get_warehouse_name(OLD.warehouse_id, OLD.warehouse_location);
  v_new_loc := fn_get_warehouse_name(NEW.warehouse_id, NEW.warehouse_location);
  
  IF (NEW.material_type      IS NOT DISTINCT FROM OLD.material_type)
  AND (new_key               IS NOT DISTINCT FROM old_key)
  AND (v_new_loc             IS NOT DISTINCT FROM v_old_loc)
  AND (NEW.qc_passed_qty     IS NOT DISTINCT FROM OLD.qc_passed_qty)
  THEN
    RETURN NEW;
  END IF;

  -- 1) Reverse OLD stock
  INSERT INTO raw_material_stock (
    material_type, roll_material_id, packaging_material_id, warehouse_location, available_qty
  )
  VALUES (
    OLD.material_type, OLD.roll_material_id, OLD.packaging_material_id, v_old_loc, -OLD.qc_passed_qty
  )
  ON CONFLICT (material_type, material_key, warehouse_location)
  DO UPDATE SET
    available_qty = raw_material_stock.available_qty + EXCLUDED.available_qty,
    last_updated = now();

  SELECT available_qty INTO old_bal
  FROM raw_material_stock
  WHERE material_type = OLD.material_type
    AND material_key = old_key
    AND warehouse_location = v_old_loc;

  INSERT INTO raw_material_ledger(
    material_type, roll_material_id, packaging_material_id,
    txn_type, reference_id, qty_out, balance_after
  )
  VALUES (
    OLD.material_type, OLD.roll_material_id, OLD.packaging_material_id,
    'RECEIPT-UPDATE-REV', NEW.id, OLD.qc_passed_qty, old_bal
  );

  -- 2) Apply NEW stock
  INSERT INTO raw_material_stock (
    material_type, roll_material_id, packaging_material_id, warehouse_location, available_qty
  )
  VALUES (
    NEW.material_type, NEW.roll_material_id, NEW.packaging_material_id, v_new_loc, NEW.qc_passed_qty
  )
  ON CONFLICT (material_type, material_key, warehouse_location)
  DO UPDATE SET
    available_qty = raw_material_stock.available_qty + EXCLUDED.available_qty,
    last_updated = now();

  SELECT available_qty INTO new_bal
  FROM raw_material_stock
  WHERE material_type = NEW.material_type
    AND material_key = new_key
    AND warehouse_location = v_new_loc;

  INSERT INTO raw_material_ledger(
    material_type, roll_material_id, packaging_material_id,
    txn_type, reference_id, qty_in, balance_after
  )
  VALUES (
    NEW.material_type, NEW.roll_material_id, NEW.packaging_material_id,
    'RECEIPT-UPDATE-ADD', NEW.id, NEW.qc_passed_qty, new_bal
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_receipt_update ON raw_material_receipts;
CREATE TRIGGER trg_post_receipt_update
AFTER UPDATE ON raw_material_receipts
FOR EACH ROW EXECUTE FUNCTION fn_post_receipt_update_to_stock();





-- 4. Post Receipt Delete to Stock
CREATE OR REPLACE FUNCTION fn_post_receipt_delete_to_stock()
RETURNS trigger AS $$
DECLARE
  old_key uuid;
  old_bal numeric;
  v_old_loc text;
BEGIN
  old_key := COALESCE(OLD.roll_material_id, OLD.packaging_material_id);
  
  v_old_loc := fn_get_warehouse_name(OLD.warehouse_id, OLD.warehouse_location);

  INSERT INTO raw_material_stock (
    material_type, roll_material_id, packaging_material_id, warehouse_location, available_qty
  )
  VALUES (
    OLD.material_type, OLD.roll_material_id, OLD.packaging_material_id, v_old_loc, -OLD.qc_passed_qty
  )
  ON CONFLICT (material_type, material_key, warehouse_location)
  DO UPDATE SET
    available_qty = raw_material_stock.available_qty + EXCLUDED.available_qty,
    last_updated = now();

  SELECT available_qty INTO old_bal
  FROM raw_material_stock
  WHERE material_type = OLD.material_type
    AND material_key = old_key
    AND warehouse_location = v_old_loc;

  INSERT INTO raw_material_ledger(
    material_type, roll_material_id, packaging_material_id,
    txn_type, reference_id, qty_out, balance_after
  )
  VALUES (
    OLD.material_type, OLD.roll_material_id, OLD.packaging_material_id,
    'RECEIPT-DELETE', OLD.id, OLD.qc_passed_qty, old_bal
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_receipt_delete ON raw_material_receipts;
CREATE TRIGGER trg_post_receipt_delete
AFTER DELETE ON raw_material_receipts
FOR EACH ROW EXECUTE FUNCTION fn_post_receipt_delete_to_stock();


-- 5. Block Receipt Edit if Issued
CREATE OR REPLACE FUNCTION fn_block_receipt_edit_if_issued()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM raw_material_issues i
    WHERE i.receipt_id = OLD.id
    LIMIT 1
  ) THEN
    IF (NEW.material_type           IS DISTINCT FROM OLD.material_type)
    OR (NEW.roll_material_id        IS DISTINCT FROM OLD.roll_material_id)
    OR (NEW.packaging_material_id   IS DISTINCT FROM OLD.packaging_material_id)
    OR (NEW.warehouse_location      IS DISTINCT FROM OLD.warehouse_location)
    OR (NEW.qc_passed_qty           IS DISTINCT FROM OLD.qc_passed_qty)
    OR (NEW.gross_qty               IS DISTINCT FROM OLD.gross_qty)
    OR (NEW.rejected_qty            IS DISTINCT FROM OLD.rejected_qty)
    OR (NEW.unit_cost               IS DISTINCT FROM OLD.unit_cost)
    THEN
      RAISE EXCEPTION 'Cannot edit receipt stock/cost fields because RM has already been issued.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_receipt_edit ON raw_material_receipts;
CREATE TRIGGER trg_block_receipt_edit
BEFORE UPDATE ON raw_material_receipts
FOR EACH ROW EXECUTE FUNCTION fn_block_receipt_edit_if_issued();






-- Stock Adjustment Trigger
CREATE OR REPLACE FUNCTION fn_apply_adjustment()
RETURNS trigger AS $$
DECLARE 
  new_balance numeric;
  v_material_key uuid;
  v_location_name text;
BEGIN

  v_material_key := COALESCE(NEW.roll_material_id, NEW.packaging_material_id);
  
  -- Resolve warehouse name from ID (using the helper we created earlier)
  v_location_name := fn_get_warehouse_name(NEW.warehouse_id, NEW.warehouse_location);

  -- 1) UPSERT Update physical stock balance
  INSERT INTO public.raw_material_stock (
      material_type, 
      roll_material_id, 
      packaging_material_id, 
      warehouse_location, 
      available_qty
      -- material_key is generated
  )
  VALUES (
      NEW.material_type, 
      NEW.roll_material_id, 
      NEW.packaging_material_id, 
      v_location_name, 
      NEW.qty_change
  )
  ON CONFLICT (material_type, material_key, warehouse_location)
  DO UPDATE SET 
      available_qty = raw_material_stock.available_qty + EXCLUDED.available_qty,
      last_updated = now();

  -- 2) Read new balance
  SELECT available_qty INTO new_balance
  FROM public.raw_material_stock
  WHERE material_type = NEW.material_type
    AND material_key = v_material_key
    AND warehouse_location = v_location_name;

  -- 3) Write to ledger
  INSERT INTO public.raw_material_ledger(
     material_type, 
     roll_material_id, 
     packaging_material_id,
     txn_type, 
     reference_id, 
     qty_in, 
     qty_out, 
     balance_after
  )
  VALUES(
     NEW.material_type,
     NEW.roll_material_id,
     NEW.packaging_material_id,
     'ADJUSTMENT',
     NEW.id,
     CASE WHEN NEW.qty_change > 0 THEN NEW.qty_change ELSE 0 END,
     CASE WHEN NEW.qty_change < 0 THEN ABS(NEW.qty_change) ELSE 0 END,
     new_balance
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_adjustment ON stock_adjustments;
CREATE TRIGGER trg_apply_adjustment
AFTER INSERT ON stock_adjustments




-- Dashboard Stats Function
CREATE OR REPLACE FUNCTION fn_get_dashboard_stats()
RETURNS json AS $$
DECLARE
  roll_rm_stock numeric;
  pkg_rm_stock numeric;
  fg_stock_value numeric;
  rm_issued_week numeric;
  low_stock_items json;
  recent_receipts json;
  recent_ledger json;
  result json;
BEGIN
  -- 1. Total Roll RM Stock
  SELECT COALESCE(SUM(available_qty), 0) INTO roll_rm_stock
  FROM raw_material_stock
  WHERE material_type = 'ROLL';

  -- 2. Total Packaging RM Stock
  SELECT COALESCE(SUM(available_qty), 0) INTO pkg_rm_stock
  FROM raw_material_stock
  WHERE material_type = 'PACKAGING';

  -- 3. FG Stock Value
  SELECT COALESCE(SUM(current_stock * COALESCE(selling_price, 0)), 0) INTO fg_stock_value
  FROM products;

  -- 4. RM Issued Last Week
  SELECT COALESCE(SUM(issued_qty), 0) INTO rm_issued_week
  FROM raw_material_issues
  WHERE issued_date >= (now() - interval '7 days');

  -- 5. Low Stock Alerts
  SELECT json_agg(t) INTO low_stock_items
  FROM (
      SELECT 
          CASE WHEN rms.material_type = 'ROLL' THEN rmm.name 
               WHEN rms.material_type = 'PACKAGING' THEN pmm.name 
          END as item,
          'Low' as status, 
          rms.available_qty || ' ' || CASE WHEN rms.material_type = 'ROLL' THEN 'KG' ELSE 'Units' END as level
      FROM raw_material_stock rms
      LEFT JOIN raw_material_roll_master rmm ON rms.roll_material_id = rmm.id
      LEFT JOIN packaging_material_master pmm ON rms.packaging_material_id = pmm.id
      WHERE rms.available_qty < 500
      LIMIT 5
  ) t;

  -- 6. Last 5 Material Receipts
  SELECT json_agg(t) INTO recent_receipts
  FROM (
    SELECT 
        CASE WHEN r.material_type = 'ROLL' THEN rmm.name 
             WHEN r.material_type = 'PACKAGING' THEN pmm.name 
        END as item,
        r.qc_passed_qty || ' ' || CASE WHEN r.material_type = 'ROLL' THEN 'KG' ELSE 'Units' END as qty,
        to_char(r.received_date, 'YYYY-MM-DD') as date
    FROM raw_material_receipts r
    LEFT JOIN raw_material_roll_master rmm ON r.roll_material_id = rmm.id
    LEFT JOIN packaging_material_master pmm ON r.packaging_material_id = pmm.id
    ORDER BY r.received_date DESC, r.created_at DESC
    LIMIT 5
  ) t;

  -- 7. Last 10 RM Ledger Entries
  SELECT json_agg(t) INTO recent_ledger
  FROM (
    SELECT 
        CASE WHEN l.material_type = 'ROLL' THEN rmm.name 
             WHEN l.material_type = 'PACKAGING' THEN pmm.name 
        END as material_name,
        l.txn_type,
        CASE 
            WHEN l.qty_in > 0 THEN '+' || l.qty_in 
            ELSE '-' || l.qty_out 
        END as qty,
        to_char(l.txn_date, 'MM-DD HH:MI AM') as date
    FROM raw_material_ledger l
    LEFT JOIN raw_material_roll_master rmm ON l.roll_material_id = rmm.id
    LEFT JOIN packaging_material_master pmm ON l.packaging_material_id = pmm.id
    ORDER BY l.txn_date DESC
    LIMIT 10
  ) t;

  result := json_build_object(
    'roll_rm_stock', roll_rm_stock,
    'pkg_rm_stock', pkg_rm_stock,
    'fg_stock_value', fg_stock_value,
    'rm_issued_week', rm_issued_week,
    'low_stock_items', COALESCE(low_stock_items, '[]'::json),
    'recent_receipts', COALESCE(recent_receipts, '[]'::json),
    'recent_ledger', COALESCE(recent_ledger, '[]'::json)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;
