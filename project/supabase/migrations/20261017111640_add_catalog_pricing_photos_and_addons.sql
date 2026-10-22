/*
# Add editable catalog pricing, dish photos, proteins and extras

This migration expands the single-tenant marmitex catalog so the administrator
can manage prices and options without changing code. Customers can see dish
photos, choose a protein with an optional surcharge, and add separate products
such as soft drinks to the order.

1. Modified table: `menu_items`
- `price` (numeric) — optional dish surcharge, default R$ 0.00
- `image_url` (text) — public URL of the dish photo, nullable

2. New tables
- `marmita_sizes` — the Pequena and Grande sizes with editable names,
  capacities, prices and visibility.
- `proteins` — protein choices with editable prices, availability and order.
- `extras` — add-on products such as refrigerante, with editable prices and
  availability.

3. Storage
- Creates the public `menu-images` bucket for menu photos.
- Limits uploads to image MIME types and 5 MB.
- Adds anon + authenticated policies for this single-tenant storefront.

4. Security
- Enables RLS on every new table.
- Adds separate SELECT, INSERT, UPDATE and DELETE policies for anon and
  authenticated roles because the storefront has no customer sign-in.
- Storage access is limited to the `menu-images` bucket.

5. Seed data
- Preserves the current R$ 17,00 / R$ 24,00 size prices.
- Seeds the current protein choices at R$ 0,00 surcharge.
- Seeds common extras including refrigerante.
*/

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS price numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url text;

CREATE TABLE IF NOT EXISTS marmita_sizes (
  id text PRIMARY KEY,
  name text NOT NULL,
  capacity text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  available boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0
);

ALTER TABLE marmita_sizes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_marmita_sizes" ON marmita_sizes;
CREATE POLICY "anon_select_marmita_sizes" ON marmita_sizes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_marmita_sizes" ON marmita_sizes;
CREATE POLICY "anon_insert_marmita_sizes" ON marmita_sizes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_marmita_sizes" ON marmita_sizes;
CREATE POLICY "anon_update_marmita_sizes" ON marmita_sizes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_marmita_sizes" ON marmita_sizes;
CREATE POLICY "anon_delete_marmita_sizes" ON marmita_sizes FOR DELETE TO anon, authenticated USING (true);

INSERT INTO marmita_sizes (id, name, capacity, price, display_order)
VALUES
  ('p', 'Marmita Pequena', '500 ml ~ (Fundo Redondo)', 17.00, 1),
  ('g', 'Marmita Grande', '750 ml ~ (Fundo Redondo)', 24.00, 2)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS proteins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  available boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE proteins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_proteins" ON proteins;
CREATE POLICY "anon_select_proteins" ON proteins FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_proteins" ON proteins;
CREATE POLICY "anon_insert_proteins" ON proteins FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_proteins" ON proteins;
CREATE POLICY "anon_update_proteins" ON proteins FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_proteins" ON proteins;
CREATE POLICY "anon_delete_proteins" ON proteins FOR DELETE TO anon, authenticated USING (true);

INSERT INTO proteins (name, price, display_order)
SELECT name, 0, row_number() OVER ()
FROM (VALUES
  ('Filé de Peito Empanado'),
  ('Bisteca Suína'),
  ('Mista (Peito Empanado + Bisteca)'),
  ('Feijoada Completa'),
  ('Omelete Recheado (Napolitano)'),
  ('Omelete Recheado (Frango c/ Milho)')
) AS seeded(name)
WHERE NOT EXISTS (SELECT 1 FROM proteins);

CREATE TABLE IF NOT EXISTS extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  available boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE extras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_extras" ON extras;
CREATE POLICY "anon_select_extras" ON extras FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_extras" ON extras;
CREATE POLICY "anon_insert_extras" ON extras FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_extras" ON extras;
CREATE POLICY "anon_update_extras" ON extras FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_extras" ON extras;
CREATE POLICY "anon_delete_extras" ON extras FOR DELETE TO anon, authenticated USING (true);

INSERT INTO extras (name, price, display_order)
SELECT name, price, row_number() OVER ()
FROM (VALUES
  ('Refrigerante lata', 6.00::numeric),
  ('Suco natural', 7.00::numeric),
  ('Água mineral', 3.00::numeric)
) AS seeded(name, price)
WHERE NOT EXISTS (SELECT 1 FROM extras);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('menu-images', 'menu-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "anon_select_menu_images" ON storage.objects;
CREATE POLICY "anon_select_menu_images" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'menu-images');
DROP POLICY IF EXISTS "anon_insert_menu_images" ON storage.objects;
CREATE POLICY "anon_insert_menu_images" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'menu-images');
DROP POLICY IF EXISTS "anon_update_menu_images" ON storage.objects;
CREATE POLICY "anon_update_menu_images" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'menu-images') WITH CHECK (bucket_id = 'menu-images');
DROP POLICY IF EXISTS "anon_delete_menu_images" ON storage.objects;
CREATE POLICY "anon_delete_menu_images" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'menu-images');
