/*
# Pedidos agendados, portal do entregador e fotos de proteínas/adicionais

## Resumo
Esta migration adiciona três funcionalidades:
1. **Pedidos agendados** — o cliente pode escolher um horário específico para entrega/retirada em vez de "o mais rápido possível".
2. **Portal do entregador** — nova tabela para cadastro de entregadores e vínculo de pedidos a um entregador específico.
3. **Fotos de proteínas e adicionais** — colunas de imagem para as tabelas `proteins` e `extras`.

## Alterações

### 1. Coluna `scheduled_for` em `orders_log`
- `scheduled_for` (timestamptz, nullable) — horário agendado pelo cliente. Se NULL, "o mais rápido possível".

### 2. Nova tabela `delivery_drivers`
- `id` (uuid, primary key)
- `name` (text, not null) — nome do entregador
- `phone` (text, not null) — telefone/WhatsApp
- `active` (boolean, default true) — disponível para receber pedidos
- `created_at` (timestamptz, default now())

### 3. Colunas de entregador em `orders_log`
- `assigned_driver_id` (uuid, nullable, FK para `delivery_drivers.id` ON DELETE SET NULL)
- `driver_picked_at` (timestamptz, nullable) — quando o entregador aceitou/buscou o pedido

### 4. Coluna `image_url` em `proteins` e `extras`
- `image_url` (text, nullable) — URL da foto, igual ao `image_url` de `menu_items`.

## Segurança
- RLS habilitado em `delivery_drivers` com policies `TO anon, authenticated` (dados compartilhados da loja).
- As colunas em `orders_log`, `proteins` e `extras` herdam as policies existentes.

## Notas
1. Todas as colunas usam `IF NOT EXISTS` para idempotência.
2. A storage bucket `menu-images` existente é reutilizada para fotos de proteínas e adicionais.
*/

-- 1. scheduled_for em orders_log
ALTER TABLE orders_log ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

-- 2. Tabela delivery_drivers
CREATE TABLE IF NOT EXISTS delivery_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_delivery_drivers" ON delivery_drivers;
CREATE POLICY "anon_select_delivery_drivers" ON delivery_drivers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_delivery_drivers" ON delivery_drivers;
CREATE POLICY "anon_insert_delivery_drivers" ON delivery_drivers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_delivery_drivers" ON delivery_drivers;
CREATE POLICY "anon_update_delivery_drivers" ON delivery_drivers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_delivery_drivers" ON delivery_drivers;
CREATE POLICY "anon_delete_delivery_drivers" ON delivery_drivers FOR DELETE
  TO anon, authenticated USING (true);

-- 3. Colunas de entregador em orders_log
ALTER TABLE orders_log ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES delivery_drivers(id) ON DELETE SET NULL;
ALTER TABLE orders_log ADD COLUMN IF NOT EXISTS driver_picked_at timestamptz;

-- 4. image_url em proteins e extras
ALTER TABLE proteins ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE extras ADD COLUMN IF NOT EXISTS image_url text;

-- Índice para buscas de pedidos agendados
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_for ON orders_log(scheduled_for);
