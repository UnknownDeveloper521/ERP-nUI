
-- Vendors Master -- VENDORS MASTER (Master of every vendor)
CREATE TABLE vendors_master (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  created_at timestamptz DEFAULT now()
);



-- Warehouses Master -- WAREHOUSES MASTER (Master of every warehouse)
CREATE TABLE warehouses_master (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text,
  location text,
  is_main boolean DEFAULT false
);


-- Machines Master -- MACHINES MASTER (Master of every machine)
CREATE TABLE machine_master (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  machine_type text,      -- Roll / Fold / Pack
  classification text,    -- Auto / Manual
  created_at timestamptz DEFAULT now()
);


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
