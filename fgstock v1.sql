
-- FG Stock
CREATE TABLE fg_stock (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  product_id uuid REFERENCES products_master(id),
  production_batch_no text,
  machine_id uuid REFERENCES machine_master(id),

  produced_qty numeric NOT NULL,       -- Total packs/rolls produced
  produced_weight numeric,             -- Total weight of FG (optional)

  available_qty numeric NOT NULL,      -- Live FG stock
  warehouse_id uuid REFERENCES warehouses_master(id),

  unit_cost numeric,                   -- Cost per pack (auto)
  total_cost numeric,                  -- Batch FG cost (auto)

  created_at timestamptz DEFAULT now()
);

-- Calculate FG cost
CREATE OR REPLACE FUNCTION fn_calc_fg_cost()
RETURNS trigger AS $$
DECLARE total_rm_cost numeric;
BEGIN
  SELECT SUM(issued_cost) INTO total_rm_cost
  FROM raw_material_issues
  WHERE production_batch_no = NEW.production_batch_no;

  NEW.total_cost := total_rm_cost;
  NEW.unit_cost := total_rm_cost / NULLIF(NEW.produced_qty,0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Create FG stock on batch completion
CREATE OR REPLACE FUNCTION fn_create_fg_stock()
RETURNS trigger AS $$
BEGIN
  INSERT INTO fg_stock(product_id, production_batch_no, machine_id,
                       produced_qty, available_qty, warehouse_id)
  VALUES(NEW.product_id, NEW.batch_no, NEW.machine_id,
         NEW.actual_qty, NEW.actual_qty,
         (SELECT id FROM warehouses_master WHERE is_main = true LIMIT 1));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_calc_fg_cost
BEFORE INSERT ON fg_stock
FOR EACH ROW EXECUTE FUNCTION fn_calc_fg_cost();

CREATE TRIGGER trg_auto_create_fg_stock
AFTER UPDATE OF status ON production_batches
FOR EACH ROW
WHEN (NEW.status = 'Completed')
EXECUTE FUNCTION fn_create_fg_stock();
