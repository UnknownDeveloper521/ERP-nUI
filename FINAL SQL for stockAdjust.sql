DROP TABLE IF EXISTS public.stock_adjustments CASCADE;

-- final
CREATE TABLE public.stock_adjustments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  material_type text NOT NULL 
    CHECK (material_type IN ('ROLL','PACKAGING')),

  roll_material_id uuid REFERENCES public.raw_material_roll_master(id),
  packaging_material_id uuid REFERENCES public.packaging_material_master(id),

  adj_type text,                -- UI-facing label: ADD / REDUCE / IN / OUT
  qty_change numeric NOT NULL,  -- +ve increases stock, -ve decreases stock
  reason text,
  approved_by uuid,
  warehouse_location text DEFAULT 'MAIN',

  created_at timestamptz DEFAULT now(),

  CONSTRAINT stock_adjustments_material_choice_chk
  CHECK (
    (material_type = 'ROLL' AND roll_material_id IS NOT NULL AND packaging_material_id IS NULL)
    OR
    (material_type = 'PACKAGING' AND packaging_material_id IS NOT NULL AND roll_material_id IS NULL)
  )
);



DROP TRIGGER IF EXISTS trg_apply_adjustment ON stock_adjustments;
DROP FUNCTION IF EXISTS fn_apply_adjustment();

CREATE OR REPLACE FUNCTION public.fn_apply_adjustment()
RETURNS trigger AS $$
DECLARE 
  new_balance numeric;
  v_material_key uuid;
BEGIN

  v_material_key := COALESCE(NEW.roll_material_id, NEW.packaging_material_id);

  -- 1) Update physical stock balance
  UPDATE public.raw_material_stock
  SET available_qty = available_qty + NEW.qty_change,
      last_updated = now()
  WHERE material_type = NEW.material_type
    AND material_key = v_material_key
    AND warehouse_location = NEW.warehouse_location;

  -- 2) Read new balance
  SELECT available_qty INTO new_balance
  FROM public.raw_material_stock
  WHERE material_type = NEW.material_type
    AND material_key = v_material_key
    AND warehouse_location = NEW.warehouse_location;

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


CREATE TRIGGER trg_apply_adjustment
AFTER INSERT ON public.stock_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.fn_apply_adjustment();



