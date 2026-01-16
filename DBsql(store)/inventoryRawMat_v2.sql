CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE raw_material_master (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_code text UNIQUE NOT NULL,
  name text NOT NULL,
  material_type text,
  gsm numeric,
  ply int,
  width_mm numeric,
  grade text,
  uom text NOT NULL DEFAULT 'KG',
  created_at timestamptz DEFAULT now()
);



DROP TABLE IF EXISTS raw_material_receipts CASCADE;

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




-- CREATE OR REPLACE FUNCTION fn_apply_rm_issue()
-- RETURNS trigger AS $$
-- DECLARE new_balance numeric;
-- BEGIN
--   -- Deduct stock
--   UPDATE raw_material_stock
--   SET available_qty = available_qty - NEW.issued_qty,
--       last_updated = now()
--   WHERE material_id = NEW.material_id;

--   -- Get updated balance
--   SELECT available_qty INTO new_balance
--   FROM raw_material_stock
--   WHERE material_id = NEW.material_id;

--   -- Insert ledger
--   INSERT INTO raw_material_ledger(material_id, txn_type, reference_id,
--                                   qty_out, balance_after)
--   VALUES(NEW.material_id, 'ISSUE', NEW.id, NEW.issued_qty, new_balance);

--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER trg_apply_rm_issue
-- AFTER INSERT ON raw_material_issues
-- FOR EACH ROW EXECUTE FUNCTION fn_apply_rm_issue();

-- SAFETY: PREVENT NEGATIVE STOCK
-- CREATE OR REPLACE FUNCTION fn_prevent_negative_stock()
-- RETURNS trigger AS $$
-- DECLARE current_qty numeric;
-- BEGIN
--   SELECT available_qty INTO current_qty
--   FROM raw_material_stock WHERE material_id = NEW.material_id;

--   IF current_qty < NEW.issued_qty THEN
--      RAISE EXCEPTION 'Insufficient stock!';
--   END IF;

--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER trg_block_negative_stock
-- BEFORE INSERT ON raw_material_issues
-- FOR EACH ROW EXECUTE FUNCTION fn_prevent_negative_stock();

-- Calculate issue cost 
-- CREATE OR REPLACE FUNCTION fn_calc_rm_issue_cost()
-- RETURNS trigger AS $$
-- DECLARE unit_cost numeric;
-- BEGIN
--   SELECT unit_cost INTO unit_cost
--   FROM raw_material_receipts WHERE id = NEW.receipt_id;

--   NEW.issued_cost := NEW.issued_weight * unit_cost;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER trg_calc_rm_issue_cost
-- BEFORE INSERT ON raw_material_issues
-- FOR EACH ROW EXECUTE FUNCTION fn_calc_rm_issue_cost();

-- -- Post issue to stock
CREATE OR REPLACE FUNCTION fn_post_rm_issue()
RETURNS trigger AS $$
DECLARE new_balance numeric;
BEGIN
  UPDATE raw_material_stock
  SET available_qty = available_qty - NEW.issued_weight,
      last_updated = now()
  WHERE material_id = NEW.material_id;

  SELECT available_qty INTO new_balance FROM raw_material_stock WHERE material_id = NEW.material_id;

  INSERT INTO raw_material_ledger(material_id, txn_type, reference_id,
                                  qty_out, balance_after)
  VALUES(NEW.material_id, 'ISSUE', NEW.id, NEW.issued_weight, new_balance);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_rm_issue
AFTER INSERT ON raw_material_issues
FOR EACH ROW EXECUTE FUNCTION fn_post_rm_issue();


-- -- SAFETY: PREVENT NEGATIVE STOCK
CREATE OR REPLACE FUNCTION fn_block_negative_rm_issue()
RETURNS trigger AS $$
DECLARE current_qty numeric;
BEGIN
  SELECT available_qty INTO current_qty
  FROM raw_material_stock WHERE material_id = NEW.material_id;

  IF current_qty < NEW.issued_weight THEN
     RAISE EXCEPTION 'Insufficient stock for RM Issue!';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_block_negative_rm_issue
BEFORE INSERT ON raw_material_issues
FOR EACH ROW EXECUTE FUNCTION fn_block_negative_rm_issue();


-- -- **************************

-- -- Raw Material Stock
-- CREATE TABLE raw_material_stock (
--   material_id uuid REFERENCES raw_material_master(id),
--   warehouse_location text,
--   available_qty numeric DEFAULT 0,
--   last_updated timestamptz DEFAULT now(),
--   PRIMARY KEY(material_id, warehouse_location)
-- );
-- CREATE TABLE raw_material_ledger (
--   id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
--   material_id uuid REFERENCES raw_material_master(id),
--   txn_type text,
--   reference_id uuid,
--   qty_in numeric DEFAULT 0,
--   qty_out numeric DEFAULT 0,
--   balance_after numeric,
--   txn_date timestamptz DEFAULT now(),
--   performed_by uuid
-- );
-- CREATE TABLE stock_adjustments (
--   id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
--   material_id uuid REFERENCES raw_material_master(id),
--   adj_type text,
--   qty_change numeric,
--   reason text,
--   approved_by uuid,
--   created_at timestamptz DEFAULT now()
-- );
-- CREATE TABLE inventory_thresholds (
--   material_id uuid PRIMARY KEY REFERENCES raw_material_master(id),
--   min_qty numeric DEFAULT 0,
--   reorder_level numeric DEFAULT 0,
--   max_qty numeric DEFAULT 0
-- );


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



CREATE OR REPLACE FUNCTION fn_post_receipt_to_stock()
RETURNS trigger AS $$
DECLARE current_balance numeric;
BEGIN
  INSERT INTO raw_material_stock(material_id, warehouse_location, available_qty)
  VALUES(NEW.material_id, NEW.warehouse_location, NEW.qc_passed_qty)
  ON CONFLICT(material_id, warehouse_location)
  DO UPDATE SET available_qty = raw_material_stock.available_qty + NEW.qc_passed_qty,
                last_updated = now();

  SELECT available_qty INTO current_balance
  FROM raw_material_stock
  WHERE material_id = NEW.material_id AND warehouse_location = NEW.warehouse_location;

  INSERT INTO raw_material_ledger(material_id, txn_type, reference_id, qty_in, balance_after)
  VALUES(NEW.material_id, 'RECEIPT', NEW.id, NEW.qc_passed_qty, current_balance);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_receipt
AFTER INSERT ON raw_material_receipts
FOR EACH ROW EXECUTE FUNCTION fn_post_receipt_to_stock();

-- CREATE OR REPLACE FUNCTION fn_post_receipt_to_stock()
-- RETURNS trigger AS $$
-- DECLARE current_balance numeric;
-- BEGIN
--   INSERT INTO raw_material_stock(material_id, warehouse_location, available_qty)
--   VALUES(NEW.material_id, NEW.warehouse_location, NEW.qc_passed_qty)
--   ON CONFLICT(material_id, warehouse_location)
--   DO UPDATE SET available_qty = raw_material_stock.available_qty + NEW.qc_passed_qty,
--                 last_updated = now();

--   SELECT available_qty INTO current_balance
--   FROM raw_material_stock
--   WHERE material_id = NEW.material_id AND warehouse_location = NEW.warehouse_location;

--   INSERT INTO raw_material_ledger(material_id, txn_type, reference_id, qty_in, balance_after)
--   VALUES(NEW.material_id, 'RECEIPT', NEW.id, NEW.qc_passed_qty, current_balance);

--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER trg_post_receipt
-- AFTER INSERT ON raw_material_receipts
-- FOR EACH ROW EXECUTE FUNCTION fn_post_receipt_to_stock();


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


-- Fixed the Above issues
