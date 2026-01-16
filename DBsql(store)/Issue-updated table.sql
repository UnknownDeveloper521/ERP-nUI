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

-- Update raw_material_receipts table
ALTER TABLE raw_material_receipts
DROP COLUMN material_id;

ALTER TABLE raw_material_receipts
ADD COLUMN material_type text CHECK (material_type IN ('ROLL','PACKAGING')),
ADD COLUMN roll_material_id uuid REFERENCES raw_material_roll_master(id),
ADD COLUMN packaging_material_id uuid REFERENCES packaging_material_master(id);

-- RM receipt table (old)
CREATE TABLE raw_material_receipts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_no text UNIQUE NOT NULL,
  material_id uuid REFERENCES raw_material_master(id),
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
  warehouse_location text DEFAULT 'MAIN',
  qc_status text DEFAULT 'Pending',
  remarks text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);



-- Followings are old tables of raw_material_master & raw_material_receipts (commented)
--  raw_material_master is replaced by the ROll and packaging 
-- CREATE TABLE raw_material_master (
--   id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
--   material_code text UNIQUE NOT NULL,
--   name text NOT NULL,
--   material_type text,
--   gsm numeric,
--   ply int,
--   width_mm numeric,
--   grade text,
--   uom text NOT NULL DEFAULT 'KG',
--   created_at timestamptz DEFAULT now()
-- );



-- DROP TABLE IF EXISTS raw_material_receipts CASCADE;

-- CREATE TABLE raw_material_receipts (
--   id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
--   receipt_no text UNIQUE NOT NULL,
--   material_id uuid REFERENCES raw_material_master(id),
--   vendor_id uuid,
--   purchase_order_no text,
--   supplier_invoice_no text,
--   lot_no text,
--   container_no text,
--   received_date date NOT NULL,
--   gross_qty numeric NOT NULL,
--   qc_passed_qty numeric NOT NULL,
--   rejected_qty numeric DEFAULT 0,
--   unit_cost numeric NOT NULL,
--   total_cost numeric,
--   warehouse_location text DEFAULT 'MAIN',
--   qc_status text DEFAULT 'Pending',
--   remarks text,
--   created_by uuid,
--   created_at timestamptz DEFAULT now()
-- );

 
DROP TABLE IF EXISTS raw_material_issues CASCADE;

CREATE TABLE raw_material_issues (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  issue_no text UNIQUE NOT NULL,
  receipt_id uuid REFERENCES raw_material_receipts(id),

  material_type text CHECK (material_type IN ('ROLL','PACKAGING')),

  roll_material_id uuid REFERENCES raw_material_roll_master(id),
  packaging_material_id uuid REFERENCES packaging_material_master(id),

  machine_id uuid REFERENCES machine_master(id),
  batch_id uuid REFERENCES production_batches(id),

  issued_qty numeric NOT NULL,       -- KG for roll / Units for packaging
  issued_cost numeric,               -- auto-calculated

  issued_date date NOT NULL,
  issued_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Function to calculate issue cost
CREATE OR REPLACE FUNCTION fn_calc_issue_cost()
RETURNS trigger AS $$
DECLARE unit_cost numeric;
BEGIN
  IF NEW.material_type = 'ROLL' THEN
     SELECT r.unit_cost INTO unit_cost FROM raw_material_receipts r WHERE r.id = NEW.receipt_id;
  ELSE
     SELECT r.unit_cost INTO unit_cost FROM raw_material_receipts r WHERE r.id = NEW.receipt_id;
  END IF;

  NEW.issued_cost := unit_cost * NEW.issued_qty;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_issue_cost
BEFORE INSERT ON raw_material_issues
FOR EACH ROW EXECUTE FUNCTION fn_calc_issue_cost();




DROP TABLE IF EXISTS raw_material_stock CASCADE;
DROP TABLE IF EXISTS raw_material_ledger CASCADE;


CREATE TABLE raw_material_stock (
  material_type text CHECK (material_type IN ('ROLL','PACKAGING')),
  roll_material_id uuid,
  packaging_material_id uuid,
  warehouse_location text,
  available_qty numeric DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  PRIMARY KEY(material_type, roll_material_id, packaging_material_id, warehouse_location)
);

CREATE TABLE raw_material_ledger (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_type text,
  roll_material_id uuid,
  packaging_material_id uuid,
  txn_type text,
  reference_id uuid,
  qty_in numeric DEFAULT 0,
  qty_out numeric DEFAULT 0,
  balance_after numeric,
  txn_date timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_post_receipt ON raw_material_receipts;

CREATE OR REPLACE FUNCTION fn_post_receipt_to_stock()
RETURNS trigger AS $$
DECLARE bal numeric;
BEGIN
  INSERT INTO raw_material_stock(material_type, roll_material_id, packaging_material_id,
                                 warehouse_location, available_qty)
  VALUES(NEW.material_type, NEW.roll_material_id, NEW.packaging_material_id,
         NEW.warehouse_location, NEW.qc_passed_qty)
  ON CONFLICT(material_type, roll_material_id, packaging_material_id, warehouse_location)
  DO UPDATE SET available_qty = raw_material_stock.available_qty + NEW.qc_passed_qty,
                last_updated = now();

  SELECT available_qty INTO bal FROM raw_material_stock
   WHERE material_type=NEW.material_type
     AND roll_material_id IS NOT DISTINCT FROM NEW.roll_material_id
     AND packaging_material_id IS NOT DISTINCT FROM NEW.packaging_material_id
     AND warehouse_location = NEW.warehouse_location;

  INSERT INTO raw_material_ledger(material_type, roll_material_id, packaging_material_id,
                                  txn_type, reference_id, qty_in, balance_after)
  VALUES(NEW.material_type, NEW.roll_material_id, NEW.packaging_material_id,
         'RECEIPT', NEW.id, NEW.qc_passed_qty, bal);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_receipt
AFTER INSERT ON raw_material_receipts
FOR EACH ROW EXECUTE FUNCTION fn_post_receipt_to_stock();


DROP TRIGGER IF EXISTS trg_post_rm_issue ON raw_material_issues;
DROP TRIGGER IF EXISTS trg_block_negative_rm_issue ON raw_material_issues;
DROP TRIGGER IF EXISTS trg_calc_rm_issue_cost ON raw_material_issues;

CREATE OR REPLACE FUNCTION fn_block_negative_rm_issue()
RETURNS trigger AS $$
DECLARE bal numeric;
BEGIN
  SELECT available_qty INTO bal FROM raw_material_stock
   WHERE material_type=NEW.material_type
     AND roll_material_id IS NOT DISTINCT FROM NEW.roll_material_id
     AND packaging_material_id IS NOT DISTINCT FROM NEW.packaging_material_id
     AND warehouse_location='MAIN';

  IF bal < NEW.issued_qty THEN
     RAISE EXCEPTION 'Insufficient stock for RM Issue';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION fn_calc_rm_issue_cost()
RETURNS trigger AS $$
DECLARE uc numeric;
BEGIN
  SELECT unit_cost INTO uc FROM raw_material_receipts WHERE id = NEW.receipt_id;
  NEW.issued_cost := NEW.issued_qty * uc;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION fn_post_rm_issue()
RETURNS trigger AS $$
DECLARE bal numeric;
BEGIN
  UPDATE raw_material_stock
  SET available_qty = available_qty - NEW.issued_qty,
      last_updated = now()
  WHERE material_type=NEW.material_type
    AND roll_material_id IS NOT DISTINCT FROM NEW.roll_material_id
    AND packaging_material_id IS NOT DISTINCT FROM NEW.packaging_material_id
    AND warehouse_location='MAIN';

  SELECT available_qty INTO bal FROM raw_material_stock
   WHERE material_type=NEW.material_type
     AND roll_material_id IS NOT DISTINCT FROM NEW.roll_material_id
     AND packaging_material_id IS NOT DISTINCT FROM NEW.packaging_material_id
     AND warehouse_location='MAIN';

  INSERT INTO raw_material_ledger(material_type, roll_material_id, packaging_material_id,
                                  txn_type, reference_id, qty_out, balance_after)
  VALUES(NEW.material_type, NEW.roll_material_id, NEW.packaging_material_id,
         'ISSUE', NEW.id, NEW.issued_qty, bal);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_block_negative_rm_issue
BEFORE INSERT ON raw_material_issues
FOR EACH ROW EXECUTE FUNCTION fn_block_negative_rm_issue();

CREATE TRIGGER trg_calc_rm_issue_cost
BEFORE INSERT ON raw_material_issues
FOR EACH ROW EXECUTE FUNCTION fn_calc_rm_issue_cost();

CREATE TRIGGER trg_post_rm_issue
AFTER INSERT ON raw_material_issues
FOR EACH ROW EXECUTE FUNCTION fn_post_rm_issue();
