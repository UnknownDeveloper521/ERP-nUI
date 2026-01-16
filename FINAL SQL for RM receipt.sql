-- DROP TRIGGER IF EXISTS trg_block_negative_rm_issue ON raw_material_issues;
-- DROP TRIGGER IF EXISTS trg_post_rm_issue ON raw_material_issues;

-- DROP FUNCTION IF EXISTS fn_block_negative_rm_issue();
-- DROP FUNCTION IF EXISTS fn_post_rm_issue();

-- DROP TABLE IF EXISTS raw_material_issues CASCADE;

-- DROP TABLE IF EXISTS production_entries CASCADE;
-- DROP TRIGGER IF EXISTS trg_auto_waste ON production_batches;
-- DROP FUNCTION IF EXISTS fn_auto_waste_calc();

-- DROP TRIGGER IF EXISTS trg_post_fg_stock ON production_batches;
-- DROP FUNCTION IF EXISTS fn_post_fg_stock();
-- DROP FUNCTION IF EXISTS fn_apply_prod_entry_cost();
-- DROP FUNCTION IF EXISTS fn_calc_batch_yield();


-- Raw Material Issues
CREATE TABLE raw_material_issues (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  issue_no text UNIQUE NOT NULL,
  receipt_id uuid REFERENCES raw_material_receipts(id),

  material_type text CHECK (material_type IN ('ROLL','PACKAGING')),
  roll_material_id uuid REFERENCES raw_material_roll_master(id),
  packaging_material_id uuid REFERENCES packaging_material_master(id),

  warehouse_location text NOT NULL,

  batch_id uuid REFERENCES production_batches(id),
  machine_id uuid REFERENCES machine_master(id),

  issued_qty numeric NOT NULL,      -- KG for Roll, Units for Packaging
  issued_cost numeric,

  issued_date timestamptz DEFAULT now(),
  issued_by uuid
);




-- Production Entries
CREATE TABLE production_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid,
  entry_time timestamptz DEFAULT now(),
  operator_name text,
  produced_qty numeric,
  status text,
  rm_issue_id uuid
);




-- Block Negative RM Issue
CREATE OR REPLACE FUNCTION fn_block_negative_rm_issue()
RETURNS trigger AS $$
DECLARE bal numeric;
BEGIN
  SELECT available_qty INTO bal
  FROM raw_material_stock
  WHERE material_type = NEW.material_type
    AND material_key = COALESCE(NEW.roll_material_id, NEW.packaging_material_id)
    AND warehouse_location = NEW.warehouse_location;

  IF bal < NEW.issued_qty THEN
     RAISE EXCEPTION 'Insufficient stock for RM Issue';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_block_negative_rm_issue
BEFORE INSERT ON raw_material_issues
FOR EACH ROW EXECUTE FUNCTION fn_block_negative_rm_issue();




-- Calculate RM Issue Cost
CREATE OR REPLACE FUNCTION fn_calc_rm_issue_cost()
RETURNS trigger AS $$
DECLARE uc numeric;
BEGIN
  SELECT unit_cost INTO uc FROM raw_material_receipts WHERE id = NEW.receipt_id;
  NEW.issued_cost := NEW.issued_qty * uc;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_rm_issue_cost
BEFORE INSERT ON raw_material_issues
FOR EACH ROW EXECUTE FUNCTION fn_calc_rm_issue_cost();



-- Post RM Issue
CREATE OR REPLACE FUNCTION fn_post_rm_issue()
RETURNS trigger AS $$
DECLARE bal numeric;
BEGIN
  UPDATE raw_material_stock
  SET available_qty = available_qty - NEW.issued_qty,
      last_updated = now()
  WHERE material_type = NEW.material_type
    AND material_key = COALESCE(NEW.roll_material_id, NEW.packaging_material_id)
    AND warehouse_location = NEW.warehouse_location;

  SELECT available_qty INTO bal FROM raw_material_stock
  WHERE material_type = NEW.material_type
    AND material_key = COALESCE(NEW.roll_material_id, NEW.packaging_material_id)
    AND warehouse_location = NEW.warehouse_location;

  INSERT INTO raw_material_ledger(material_type, roll_material_id, packaging_material_id,
                                  txn_type, reference_id, qty_out, balance_after)
  VALUES(NEW.material_type, NEW.roll_material_id, NEW.packaging_material_id,
         'ISSUE', NEW.id, NEW.issued_qty, bal);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_rm_issue
AFTER INSERT ON raw_material_issues
FOR EACH ROW EXECUTE FUNCTION fn_post_rm_issue();




