CREATE TABLE public.inventory_thresholds (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_type text NOT NULL,
  material_id uuid NOT NULL,
  warehouse_location text NOT NULL,
  min_qty numeric DEFAULT 0,
  reorder_level numeric DEFAULT 0,
  max_qty numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (material_type, material_id, warehouse_location)
);


CREATE OR REPLACE FUNCTION fn_check_rm_alert(p_material_type text, p_material_id uuid, p_warehouse text)
RETURNS text AS $$
DECLARE
  v_stock numeric;
  v_min numeric;
  v_reorder numeric;
BEGIN
  SELECT available_qty INTO v_stock
  FROM raw_material_stock
  WHERE material_type = p_material_type
    AND material_key = p_material_id
    AND warehouse_location = p_warehouse;

  SELECT min_qty, reorder_level
  INTO v_min, v_reorder
  FROM inventory_thresholds
  WHERE material_type = p_material_type
    AND material_id = p_material_id
    AND warehouse_location = p_warehouse;

  IF v_stock IS NULL THEN
     RETURN 'NO STOCK';
  ELSIF v_stock <= v_min THEN
     RETURN 'CRITICAL';
  ELSIF v_stock <= v_reorder THEN
     RETURN 'REORDER';
  ELSE
     RETURN 'OK';
  END IF;
END;
$$ LANGUAGE plpgsql;



CREATE TABLE IF NOT EXISTS stock_alert_log (
  id uuid DEFAULT uuid_generate_v4(),
  material_type text,
  material_id uuid,
  warehouse_location text,
  available_qty numeric,
  alert_status text,
  checked_at timestamptz DEFAULT now()
);


CREATE OR REPLACE FUNCTION fn_log_stock_alert()
RETURNS trigger AS $$
DECLARE
  v_status text;
BEGIN
  v_status := fn_check_rm_alert(
      NEW.material_type,
      NEW.material_key,
      NEW.warehouse_location
  );

  INSERT INTO stock_alert_log
  (material_type, material_id, warehouse_location, available_qty, alert_status)
  VALUES
  (NEW.material_type, NEW.material_key, NEW.warehouse_location, NEW.available_qty, v_status);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_alert
AFTER UPDATE ON raw_material_stock
FOR EACH ROW
EXECUTE FUNCTION fn_log_stock_alert();
