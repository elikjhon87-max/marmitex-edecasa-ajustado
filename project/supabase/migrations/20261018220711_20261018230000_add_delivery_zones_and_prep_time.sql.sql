/*
# Add delivery zones, preparation time, and motoboy support

1. New Tables
- `delivery_zones`: bairros/atendimentos com preço de entrega e tempo estimado
  - `id` (uuid, primary key)
  - `name` (text, nome do bairro/zona)
  - `delivery_fee` (numeric, taxa de entrega)
  - `estimated_minutes` (integer, tempo estimado de entrega em minutos)
  - `active` (boolean, se está disponível para pedidos)
  - `display_order` (integer, ordem de exibição)
  - `created_at` (timestamptz)

2. Modified Tables
- `business_config`: adiciona colunas
  - `prep_time_minutes` (integer, tempo médio de preparo das marmitas, default 30)
  - `store_address` (text, endereço da loja para referência/retirada)

3. Security
- Enable RLS em `delivery_zones`.
- Policies anon+authenticated CRUD (single-tenant, sem login de cliente).
*/

CREATE TABLE IF NOT EXISTS delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  delivery_fee numeric NOT NULL DEFAULT 0,
  estimated_minutes integer NOT NULL DEFAULT 30,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_delivery_zones" ON delivery_zones;
CREATE POLICY "anon_select_delivery_zones" ON delivery_zones FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_delivery_zones" ON delivery_zones;
CREATE POLICY "anon_insert_delivery_zones" ON delivery_zones FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_delivery_zones" ON delivery_zones;
CREATE POLICY "anon_update_delivery_zones" ON delivery_zones FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_delivery_zones" ON delivery_zones;
CREATE POLICY "anon_delete_delivery_zones" ON delivery_zones FOR DELETE
  TO anon, authenticated USING (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'prep_time_minutes') THEN
    ALTER TABLE business_config ADD COLUMN prep_time_minutes integer NOT NULL DEFAULT 30;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'store_address') THEN
    ALTER TABLE business_config ADD COLUMN store_address text NOT NULL DEFAULT '';
  END IF;
END $$;

INSERT INTO delivery_zones (name, delivery_fee, estimated_minutes, active, display_order)
SELECT * FROM (VALUES
  ('Centro', 5.00, 20, true, 1),
  ('Bairros próximos', 7.00, 30, true, 2),
  ('Bairros distantes', 10.00, 45, true, 3)
) AS v(name, delivery_fee, estimated_minutes, active, display_order)
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones);
