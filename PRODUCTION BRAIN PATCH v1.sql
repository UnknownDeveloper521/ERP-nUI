
-- Ensure production batch no is not null
ALTER TABLE raw_material_issues
ALTER COLUMN production_batch_no SET NOT NULL;


-- Add yield columns
ALTER TABLE production_batches
ADD COLUMN total_issued_weight numeric,
ADD COLUMN total_produced_qty numeric,
ADD COLUMN waste_qty numeric,
ADD COLUMN yield_rate numeric,
ADD COLUMN waste_pct numeric;


-- Calculate batch yield
CREATE OR REPLACE FUNCTION fn_calc_batch_yield()
RETURNS trigger AS $$
DECLARE issued numeric;
BEGIN
  SELECT SUM(issued_weight) INTO issued
  FROM raw_material_issues WHERE production_batch_no = NEW.batch_no;

  NEW.total_issued_weight := issued;
  NEW.total_produced_qty := NEW.actual_qty;
  NEW.waste_qty := issued - NEW.actual_qty;
  NEW.yield_rate := ROUND((NEW.actual_qty / issued) * 100,2);
  NEW.waste_pct := ROUND(((issued - NEW.actual_qty) / issued) * 100,2);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_batch_yield
BEFORE UPDATE OF actual_qty ON production_batches
FOR EACH ROW EXECUTE FUNCTION fn_calc_batch_yield();


-- Apply production entry cost
CREATE OR REPLACE FUNCTION fn_apply_prod_entry_cost()
RETURNS trigger AS $$
BEGIN
  UPDATE production_batches
  SET actual_qty = COALESCE(actual_qty,0) + NEW.produced_qty
  WHERE id = NEW.batch_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_prod_entry
AFTER INSERT ON production_entries
FOR EACH ROW EXECUTE FUNCTION fn_apply_prod_entry_cost();
