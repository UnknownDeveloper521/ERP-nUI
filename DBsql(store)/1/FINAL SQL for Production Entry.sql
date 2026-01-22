CREATE TABLE IF NOT EXISTS public.production_batches (
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

CREATE TABLE IF NOT EXISTS public.production_batch_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  batch_id uuid NOT NULL,
  batch_no text,
  batch_date date,
  shift text,

  machine_id uuid,
  operator_id uuid,

  fg_product_id uuid,

  roll_material_id uuid,
  packaging_material_id uuid,

  rm_roll_qty numeric,
  rm_packaging_qty numeric,

  status text,
  started_at timestamptz,
  completed_at timestamptz,

  source_created_at timestamptz,
  source_updated_at timestamptz,

  -- audit fields
  operation text NOT NULL,            -- INSERT / UPDATE / DELETE
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prod_batch_records_batch_id
  ON public.production_batch_records(batch_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_prod_batch_records_recorded_at
  ON public.production_batch_records(recorded_at DESC);


DROP TRIGGER IF EXISTS trg_log_production_batch ON public.production_batches;

CREATE OR REPLACE FUNCTION public.fn_log_production_batch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.production_batch_records (
      batch_id, batch_no, batch_date, shift,
      machine_id, operator_id, fg_product_id,
      roll_material_id, packaging_material_id,
      rm_roll_qty, rm_packaging_qty,
      status, started_at, completed_at,
      source_created_at, source_updated_at,
      operation
    )
    VALUES (
      OLD.id, OLD.batch_no, OLD.batch_date, OLD.shift,
      OLD.machine_id, OLD.operator_id, OLD.product_id,   
      OLD.roll_material_id, OLD.packaging_material_id,
      OLD.rm_roll_qty, OLD.rm_packaging_qty,
      OLD.status, OLD.started_at, OLD.completed_at,
      OLD.created_at, OLD.updated_at,
      TG_OP
    );

    RETURN OLD;
  ELSE
    INSERT INTO public.production_batch_records (
      batch_id, batch_no, batch_date, shift,
      machine_id, operator_id, fg_product_id,
      roll_material_id, packaging_material_id,
      rm_roll_qty, rm_packaging_qty,
      status, started_at, completed_at,
      source_created_at, source_updated_at,
      operation
    )
    VALUES (
      NEW.id, NEW.batch_no, NEW.batch_date, NEW.shift,
      NEW.machine_id, NEW.operator_id, NEW.product_id,   
      NEW.roll_material_id, NEW.packaging_material_id,
      NEW.rm_roll_qty, NEW.rm_packaging_qty,
      NEW.status, NEW.started_at, NEW.completed_at,
      NEW.created_at, NEW.updated_at,
      TG_OP
    );

    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_log_production_batch
AFTER INSERT OR UPDATE OR DELETE ON public.production_batches
FOR EACH ROW
EXECUTE FUNCTION public.fn_log_production_batch();