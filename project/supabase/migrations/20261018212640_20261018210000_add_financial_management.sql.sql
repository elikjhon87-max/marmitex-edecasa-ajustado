/*
# Add PIX key, financial tracking, orders log, suppliers and price research

This migration adds comprehensive business management features to the admin panel:

1. Modified table: `business_config`
- `pix_key` (text) — the PIX key shown to customers for adiantado payments
- `pix_key_type` (text) — tipo da chave (cpf, email, telefone, aleatoria)

2. New table: `orders_log`
- Records every order sent by customers (including paid status)
- Tracks revenue for financial reports

3. New table: `expense_categories`
- Categories: ingredientes, recipientes, produtos, gas, outros
- Seeded defaults

4. New table: `expenses`
- Each expense: category, description, amount, date, supplier (optional)
- Used for profit calculations and reports

5. New table: `suppliers`
- Local suppliers with name, address, notes, location

6. New table: `supplier_prices`
- Best prices per ingredient/product per supplier
- Allows comparing prices to find cheapest source

All tables are single-tenant (no auth) with anon+authenticated CRUD.
*/

ALTER TABLE business_config
  ADD COLUMN IF NOT EXISTS pix_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pix_key_type text NOT NULL DEFAULT 'cpf';

CREATE TABLE IF NOT EXISTS orders_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_phone text NOT NULL DEFAULT '',
  customer_address text NOT NULL DEFAULT '',
  items_summary text NOT NULL DEFAULT '',
  total numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'pix',
  payment_timing text NOT NULL DEFAULT 'entrega',
  paid boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','confirmado','entregue','cancelado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_orders_log" ON orders_log;
CREATE POLICY "anon_select_orders_log" ON orders_log FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_orders_log" ON orders_log;
CREATE POLICY "anon_insert_orders_log" ON orders_log FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_orders_log" ON orders_log;
CREATE POLICY "anon_update_orders_log" ON orders_log FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_orders_log" ON orders_log;
CREATE POLICY "anon_delete_orders_log" ON orders_log FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS expense_categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0
);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_expense_categories" ON expense_categories;
CREATE POLICY "anon_select_expense_categories" ON expense_categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_expense_categories" ON expense_categories;
CREATE POLICY "anon_insert_expense_categories" ON expense_categories FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_expense_categories" ON expense_categories;
CREATE POLICY "anon_update_expense_categories" ON expense_categories FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_expense_categories" ON expense_categories;
CREATE POLICY "anon_delete_expense_categories" ON expense_categories FOR DELETE TO anon, authenticated USING (true);

INSERT INTO expense_categories (id, name, display_order)
VALUES
  ('ingredientes', 'Ingredientes', 1),
  ('recipientes', 'Recipientes (marmitas, tampas)', 2),
  ('produtos', 'Produtos (bebidas, extras)', 3),
  ('gas', 'Gás / Energia', 4),
  ('outros', 'Outros', 5)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id text NOT NULL REFERENCES expense_categories(id),
  description text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  supplier_id uuid,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_expenses" ON expenses;
CREATE POLICY "anon_select_expenses" ON expenses FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_expenses" ON expenses;
CREATE POLICY "anon_insert_expenses" ON expenses FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_expenses" ON expenses;
CREATE POLICY "anon_update_expenses" ON expenses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_expenses" ON expenses;
CREATE POLICY "anon_delete_expenses" ON expenses FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text DEFAULT '',
  location_hint text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_suppliers" ON suppliers;
CREATE POLICY "anon_select_suppliers" ON suppliers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_suppliers" ON suppliers;
CREATE POLICY "anon_insert_suppliers" ON suppliers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_suppliers" ON suppliers;
CREATE POLICY "anon_update_suppliers" ON suppliers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_suppliers" ON suppliers;
CREATE POLICY "anon_delete_suppliers" ON suppliers FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS supplier_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  notes text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE supplier_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_supplier_prices" ON supplier_prices;
CREATE POLICY "anon_select_supplier_prices" ON supplier_prices FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_supplier_prices" ON supplier_prices;
CREATE POLICY "anon_insert_supplier_prices" ON supplier_prices FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_supplier_prices" ON supplier_prices;
CREATE POLICY "anon_update_supplier_prices" ON supplier_prices FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_supplier_prices" ON supplier_prices;
CREATE POLICY "anon_delete_supplier_prices" ON supplier_prices FOR DELETE TO anon, authenticated USING (true);
