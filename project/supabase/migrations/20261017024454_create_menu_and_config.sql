/*
# Create menu_items and business_config tables (single-tenant, no auth)

This app is a marmitex (Brazilian lunchbox) ordering storefront. Customers place
orders through a WhatsApp link; there is no customer sign-in. An admin password
gate in the frontend manages menu items and business contact info. Because there
is no real auth, all policies use anon, authenticated with USING (true) — the
data is intentionally public/shared.

1. New Tables
- `menu_items`: the list of dishes shown on the storefront.
  - id (uuid, PK)
  - title (text, not null) — dish name shown to customer
  - description (text) — sides/accompaniments
  - category (text, default 'Geral') — e.g. Especial, Tradicional
  - available (boolean, default true) — toggle to hide without deleting
  - created_at (timestamptz)
- `business_config`: a singleton row (id fixed to 1) holding phone numbers,
  address, hours and instagram handle shown in the footer/header.
  - id (int, PK, default 1, check id = 1)
  - primary_phone (text)
  - secondary_phone (text)
  - address (text)
  - hours (text)
  - instagram (text)

2. Security
- RLS enabled on both tables.
- anon + authenticated CRUD allowed (USING/WITH CHECK true) because the app has
  no sign-in and the data is intentionally public/shared.

3. Seed data
- Inserts the three default menu items and one business_config row if absent.
*/

CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL DEFAULT 'Geral',
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_menu_items" ON menu_items;
CREATE POLICY "anon_select_menu_items" ON menu_items FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_menu_items" ON menu_items;
CREATE POLICY "anon_insert_menu_items" ON menu_items FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_menu_items" ON menu_items;
CREATE POLICY "anon_update_menu_items" ON menu_items FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_menu_items" ON menu_items;
CREATE POLICY "anon_delete_menu_items" ON menu_items FOR DELETE
TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS business_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  primary_phone text NOT NULL DEFAULT '31996647863',
  secondary_phone text NOT NULL DEFAULT '31995956952',
  address text NOT NULL DEFAULT 'Belo Horizonte - MG (Entregas na Região)',
  hours text NOT NULL DEFAULT 'A partir das 09:30 (Segunda a Sábado)',
  instagram text NOT NULL DEFAULT 'Edecasa | Comida Caseira'
);

ALTER TABLE business_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_business_config" ON business_config;
CREATE POLICY "anon_select_business_config" ON business_config FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_business_config" ON business_config;
CREATE POLICY "anon_insert_business_config" ON business_config FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_business_config" ON business_config;
CREATE POLICY "anon_update_business_config" ON business_config FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_business_config" ON business_config;
CREATE POLICY "anon_delete_business_config" ON business_config FOR DELETE
TO anon, authenticated USING (true);

-- Seed default menu items (only if table is empty)
INSERT INTO menu_items (title, description, category)
SELECT * FROM (VALUES
  ('Sexta-feira é Dia de Feijoada! (Opção 1)', 'Arroz, Feijoada completa, Farofa, Couve refogada, Laranja e Torresmo crocante.', 'Especial'),
  ('Omelete Recheado Especial (Opção 2)', 'Arroz, Feijão Carioca, Omelete Recheado (Napolitano, Frango com Milho ou Legumes), Batata Frita e Salada.', 'Especial'),
  ('Marmita Tradicional da Casa', 'Arroz soltinho, Feijão Carioca temperado, Escolha de Proteína (Filé de Frango, Bisteca Suína ou Mista) e acompanhamentos do dia.', 'Tradicional')
) AS v(title, description, category)
WHERE NOT EXISTS (SELECT 1 FROM menu_items);

-- Seed default business config (only if missing)
INSERT INTO business_config (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM business_config);
