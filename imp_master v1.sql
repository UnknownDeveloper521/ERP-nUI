
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
