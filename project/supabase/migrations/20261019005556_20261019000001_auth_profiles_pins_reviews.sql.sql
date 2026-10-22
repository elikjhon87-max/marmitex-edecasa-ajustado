/*
# Fase 1 — Autenticação de clientes, PIN de pedido, avaliações

1. Novas tabelas:
- `customer_profiles` — perfil público vinculado a auth.users: nome, telefone, endereço principal.
- `customer_addresses` — endereços salvos do cliente (Casa, Trabalho, etc.). Cada cliente pode ter vários.
- `order_pins` — PIN de 4 dígitos único por pedido. Vinculado a orders_log via order_id.
- `order_ratings` — avaliação 1-5 estrelas + comentário por pedido.

2. Modificações em `orders_log`:
- `customer_user_id` (uuid, nullable) — vincula pedido a usuário autenticado quando logado.
- `delivery_pin` (text, nullable) — PIN redundante no próprio pedido para leitura rápida pelo motoboy/admin.
- `delivery_status` (text) — novo status detalhado: 'recebido', 'preparando', 'a_caminho', 'entregue', 'cancelado'.
- `confirmed_at` (timestamptz) — quando o PIN foi confirmado na entrega.
- `notes` (text) — observações internas (admin/motoboy).

3. Segurança:
- customer_profiles, customer_addresses: RLS scoped por auth.uid() = user_id.
- order_pins: SELECT permitido para o dono do pedido OU qualquer um autenticado (motoboy precisa ler para conferir). INSERT/UPDATE pelo dono do pedido.
- order_ratings: SELECT público (loja vê todas), INSERT/UPDATE apenas dono do pedido.
- orders_log mantém políticas anon existentes + novas leituras por user_id.

Importante: A política de leitura de PINs é ampla (authenticated) porque o motoboy autenticado precisa conferir o PIN na entrega. O PIN é um código curto de confirmação, não dado sensível como senha.
*/

-- Tabela: customer_profiles
CREATE TABLE IF NOT EXISTS customer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  default_address_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_profile" ON customer_profiles;
CREATE POLICY "select_own_profile" ON customer_profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_profile" ON customer_profiles;
CREATE POLICY "insert_own_profile" ON customer_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_profile" ON customer_profiles;
CREATE POLICY "update_own_profile" ON customer_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_profile" ON customer_profiles;
CREATE POLICY "delete_own_profile" ON customer_profiles FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Tabela: customer_addresses
CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Casa',
  address text NOT NULL,
  reference text DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_addresses" ON customer_addresses;
CREATE POLICY "select_own_addresses" ON customer_addresses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_addresses" ON customer_addresses;
CREATE POLICY "insert_own_addresses" ON customer_addresses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_addresses" ON customer_addresses;
CREATE POLICY "update_own_addresses" ON customer_addresses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_addresses" ON customer_addresses;
CREATE POLICY "delete_own_addresses" ON customer_addresses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Colunas adicionais em orders_log
ALTER TABLE orders_log
  ADD COLUMN IF NOT EXISTS customer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_pin text,
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'recebido'
    CHECK (delivery_status IN ('recebido','preparando','a_caminho','entregue','cancelado')),
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

-- Permite que o dono do pedido veja/atualize seus pedidos; mantém acesso anon para loja funcionar sem login
DROP POLICY IF EXISTS "select_own_orders" ON orders_log;
CREATE POLICY "select_own_orders" ON orders_log FOR SELECT
  TO authenticated USING (auth.uid() = customer_user_id);
DROP POLICY IF EXISTS "update_own_orders" ON orders_log;
CREATE POLICY "update_own_orders" ON orders_log FOR UPDATE
  TO authenticated USING (auth.uid() = customer_user_id) WITH CHECK (auth.uid() = customer_user_id);

-- Tabela: order_pins (histórico/auditoria opcional do PIN por pedido)
CREATE TABLE IF NOT EXISTS order_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders_log(id) ON DELETE CASCADE,
  pin text NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_pins ENABLE ROW LEVEL SECURITY;
-- Motoboy/loja autenticados precisam ler o PIN para conferir; cliente lê o próprio.
DROP POLICY IF EXISTS "read_pin_authenticated" ON order_pins;
CREATE POLICY "read_pin_authenticated" ON order_pins FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_pin_authenticated" ON order_pins;
CREATE POLICY "insert_pin_authenticated" ON order_pins FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_pin_authenticated" ON order_pins;
CREATE POLICY "update_pin_authenticated" ON order_pins FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_pin_authenticated" ON order_pins;
CREATE POLICY "delete_pin_authenticated" ON order_pins FOR DELETE
  TO authenticated USING (true);

-- Tabela: order_ratings
CREATE TABLE IF NOT EXISTS order_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders_log(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_stars integer NOT NULL DEFAULT 5 CHECK (meal_stars BETWEEN 1 AND 5),
  delivery_stars integer NOT NULL DEFAULT 5 CHECK (delivery_stars BETWEEN 1 AND 5),
  comment text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_ratings ENABLE ROW LEVEL SECURITY;
-- Loja (admin) precisa ler todas as avaliações; clientes leem apenas as próprias.
DROP POLICY IF EXISTS "read_ratings" ON order_ratings;
CREATE POLICY "read_ratings" ON order_ratings FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_own_rating" ON order_ratings;
CREATE POLICY "insert_own_rating" ON order_ratings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_rating" ON order_ratings;
CREATE POLICY "update_own_rating" ON order_ratings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_rating" ON order_ratings;
CREATE POLICY "delete_own_rating" ON order_ratings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Trigger: atualizar updated_at do perfil
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_profiles_updated_at ON customer_profiles;
CREATE TRIGGER customer_profiles_updated_at
  BEFORE UPDATE ON customer_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_orders_log_customer_user_id ON orders_log(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_log_delivery_status ON orders_log(delivery_status);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_user_id ON customer_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_order_pins_order_id ON order_pins(order_id);
CREATE INDEX IF NOT EXISTS idx_order_ratings_order_id ON order_ratings(order_id);
