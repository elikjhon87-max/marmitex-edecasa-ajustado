/*
# Add coupons, menu days, and business hours

1. New Tables
- `coupons`: cupons de desconto para clientes
  - `id` (uuid, primary key)
  - `code` (text, codigo do cupom, unico, ex: DOMINGO10)
  - `description` (text, descricao interna)
  - `discount_type` (text, 'percent' ou 'fixed')
  - `discount_value` (numeric, valor do desconto: percentual ou valor fixo)
  - `active` (boolean, se esta ativo)
  - `expires_at` (date, data de expiracao, opcional)
  - `created_at` (timestamptz)

2. Modified Tables
- `menu_items`: adiciona coluna `available_days` (text[], dias da semana em que o prato esta disponivel)
  - Valores: 'mon','tue','wed','thu','fri','sat','sun'. Se vazio/null, disponivel todos os dias.
- `business_config`: adiciona colunas de horario de funcionamento
  - `open_hours` (text, horario de abertura, ex: '18:00')
  - `close_hours` (text, horario de fechamento, ex: '23:00')
  - `closed_days` (text[], dias da semana em que a loja esta fechada, ex: ['sun'])

3. Security
- Enable RLS em `coupons`.
- Policies anon+authenticated CRUD (single-tenant, sem login de cliente).
*/

CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT '',
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_coupons" ON coupons;
CREATE POLICY "anon_select_coupons" ON coupons FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_coupons" ON coupons;
CREATE POLICY "anon_insert_coupons" ON coupons FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_coupons" ON coupons;
CREATE POLICY "anon_update_coupons" ON coupons FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_coupons" ON coupons;
CREATE POLICY "anon_delete_coupons" ON coupons FOR DELETE
  TO anon, authenticated USING (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'available_days') THEN
    ALTER TABLE menu_items ADD COLUMN available_days text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'open_hours') THEN
    ALTER TABLE business_config ADD COLUMN open_hours text NOT NULL DEFAULT '18:00';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'close_hours') THEN
    ALTER TABLE business_config ADD COLUMN close_hours text NOT NULL DEFAULT '23:00';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'closed_days') THEN
    ALTER TABLE business_config ADD COLUMN closed_days text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

INSERT INTO coupons (code, description, discount_type, discount_value, active)
SELECT * FROM (VALUES
  ('BEMVINDO10', '10% off para clientes novos', 'percent', 10, true)
) AS v(code, description, discount_type, discount_value, active)
WHERE NOT EXISTS (SELECT 1 FROM coupons);
