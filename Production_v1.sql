
-- Products Master -- PRODUCTS MASTER (Master of every product)
CREATE TABLE products_master (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_code text UNIQUE NOT NULL,
  name text NOT NULL,
  category text,
  type text,
  grade text,
  gsm numeric,
  ply int,
  avg_weight numeric,
  packaging_sizes jsonb,
  created_at timestamptz DEFAULT now()
);



-- Production Batches -- PRODUCTION BATCH (Master of every run)
CREATE TABLE production_batches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_no text UNIQUE NOT NULL,
  product_id uuid REFERENCES products_master(id),
  machine_id uuid REFERENCES machine_master(id),
  shift text,
  planned_qty numeric,
  actual_qty numeric,
  status text DEFAULT 'Running',
  started_at timestamptz,
  completed_at timestamptz
);

-- Production Entries -- PRODUCTION ENTRY (Every entry of raw material into machine)
CREATE TABLE production_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid REFERENCES production_batches(id),
  entry_time timestamptz DEFAULT now(),
  operator_name text,
  produced_qty numeric,
  status text
);

-- Production Quality Checks -- QUALITY CHECK (Every quality check of production batch)
CREATE TABLE production_quality_checks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid REFERENCES production_batches(id),
  sample_size int,
  passed_qty int,
  failed_qty int,
  inspector text,
  result text,
  created_at timestamptz DEFAULT now()
);

-- Production Waste Logs -- WASTE LOG (Every waste log of production batch)
CREATE TABLE production_waste_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid REFERENCES production_batches(id),
  material_id uuid REFERENCES raw_material_master(id),
  waste_qty numeric,
  waste_reason text,
  created_at timestamptz DEFAULT now()
);

-- Machine Performance Logs -- MACHINE PERFORMANCE LOG (Every performance log of machine)
CREATE TABLE machine_performance_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id uuid REFERENCES machine_master(id),
  runtime_min numeric,
  downtime_min numeric,
  cycles numeric,
  log_date date
);


-- Shift Summaries -- SHIFT SUMMARY (Every shift summary of machine)
CREATE TABLE shift_summaries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift text,
  machine_id uuid REFERENCES machine_master(id),
  planned_qty numeric,
  actual_qty numeric,
  downtime_min numeric,
  remarks text,
  log_date date
);


-- FG Stock -- FG STOCK (Every FG stock of production batch)
CREATE OR REPLACE FUNCTION fn_post_fg_stock()
RETURNS trigger AS $$
BEGIN
  INSERT INTO fg_stock(product_id, batch_no, qty_units)
  VALUES(NEW.product_id, NEW.batch_no, NEW.actual_qty);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_fg_stock
AFTER UPDATE OF status ON production_batches
FOR EACH ROW
WHEN (NEW.status = 'Completed')
EXECUTE FUNCTION fn_post_fg_stock();


-- Auto Waste Calculation -- AUTO WASTE CALCULATION (Every auto waste calculation of production batch)
CREATE OR REPLACE FUNCTION fn_auto_waste_calc()
RETURNS trigger AS $$
DECLARE issued numeric;
DECLARE produced numeric;
BEGIN
  SELECT SUM(issued_weight) INTO issued FROM raw_material_issues WHERE production_batch_no = NEW.batch_no;
  produced := NEW.actual_qty;

  INSERT INTO production_waste_logs(batch_id, waste_qty, waste_reason)
  VALUES(NEW.id, issued - produced, 'Auto Yield Loss');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_waste
AFTER UPDATE OF actual_qty ON production_batches
FOR EACH ROW
EXECUTE FUNCTION fn_auto_waste_calc();
