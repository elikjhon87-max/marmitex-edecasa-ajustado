/*
# Segurança e carteira do entregador: documentos, PIN de retirada, carteira e rotas multi-pedido

## Resumo
Adiciona verificação de identidade do entregador (CNH, foto, identificação do veículo), PIN de retirada na loja, sistema de carteira interna com cálculo de pagamento por entrega, e suporte a rotas multi-pedido (entregador sai com vários pedidos próximos).

## Alterações

### 1. Novas colunas em `delivery_drivers` (documentos de verificação)
- `cnh_number` (text, nullable) — número da CNH.
- `cnh_category` (text, nullable) — categoria da CNH (A, B, AB, etc).
- `cnh_image_url` (text, nullable) — foto da CNH (upload para storage).
- `photo_url` (text, nullable) — foto de verificação (selfie) do entregador.
- `vehicle_plate` (text, nullable) — placa do veículo (moto/carro/caminhonete).
- `vehicle_model` (text, nullable) — modelo/cor do veículo.
- `document_url` (text, nullable) — documento de identificação adicional (RG/CPF).
- `verification_status` (text, default 'pending') — 'pending', 'verified', 'rejected'.
- `verification_notes` (text, nullable) — notas da loja sobre a verificação.
- `wallet_balance` (numeric, default 0) — saldo atual da carteira do entregador.
- `driver_earnings` (numeric, default 0) — total acumulado de ganhos.
- `driver_payouts` (numeric, default 0) — total já pago/sacado.

### 2. Novas colunas em `orders_log` (PIN de retirada e rota)
- `pickup_pin` (text, nullable) — PIN de 4 dígitos que o entregador digita na loja para retirar o pedido.
- `pickup_verified_at` (timestamptz, nullable) — quando o PIN foi verificado.
- `delivery_route_id` (uuid, nullable) — ID da rota multi-pedido (agrupa pedidos entregues juntos).
- `delivery_earnings` (numeric, default 0) — quanto o entregador ganhou por esta entrega.
- `route_sequence` (integer, nullable) — ordem do pedido na rota multi-pedido.

### 3. Novas colunas em `business_config` (configuração de pagamento do entregador)
- `driver_fee_per_km` (numeric, default 1.50) — quanto o entregador ganha por km rodado.
- `driver_fee_per_order` (numeric, default 3.00) — valor fixo por pedido entregue.
- `driver_fee_multiplier_batch` (numeric, default 0.5) — multiplicador para pedidos adicionais na mesma rota (ex: 0.5 = segundo pedido paga 50%).
- `driver_batch_radius_km` (numeric, default 2.0) — raio em km para agrupar pedidos na mesma rota.
- `pickup_pin_enabled` (boolean, default true) — se o PIN de retirada está ativo.

### 4. Nova tabela `delivery_routes`
- `id` (uuid, primary key)
- `driver_id` (uuid, references delivery_drivers)
- `status` (text, default 'active') — 'active', 'completed', 'cancelled'
- `total_distance_km` (numeric, default 0) — distância total da rota
- `total_earnings` (numeric, default 0) — ganho total do entregador na rota
- `started_at` (timestamptz, default now())
- `completed_at` (timestamptz, nullable)
- `order_count` (integer, default 0) — quantos pedidos na rota

### 5. Nova tabela `driver_wallet_transactions`
- `id` (uuid, primary key)
- `driver_id` (uuid, references delivery_drivers)
- `type` (text) — 'earning' (ganho de entrega), 'payout' (saque/pagamento), 'bonus', 'adjustment'
- `amount` (numeric) — valor (positivo para ganho, negativo para saque)
- `balance_after` (numeric) — saldo após a transação
- `description` (text)
- `order_id` (uuid, nullable, references orders_log)
- `route_id` (uuid, nullable, references delivery_routes)
- `created_at` (timestamptz, default now())

### 6. Nova tabela `driver_documents`
- `id` (uuid, primary key)
- `driver_id` (uuid, references delivery_drivers)
- `doc_type` (text) — 'cnh', 'photo', 'vehicle_doc', 'id_document'
- `file_url` (text) — URL do arquivo no storage
- `status` (text, default 'pending') — 'pending', 'approved', 'rejected'
- `reviewed_at` (timestamptz, nullable)
- `created_at` (timestamptz, default now())

## Segurança
- RLS habilitado em todas as novas tabelas com policies `TO anon, authenticated` (app sem login obrigatório para entregador via PIN).
- `driver_wallet_transactions` e `delivery_routes` são compartilhados entre o app do entregador e o admin.
- `driver_documents` é compartilhado (entregador envia, admin revisa).

## Notas
1. O PIN de retirada é gerado automaticamente quando o pedido é aceito pelo entregador. A loja mostra o PIN na tela do admin e o entregador digita no portal para confirmar a retirada.
2. A carteira é creditada quando o pedido é marcado como entregue. O admin pode fazer saques/pagamentos que debitam a carteira.
3. Rotas multi-pedido: o entregador pode aceitar vários pedidos cujos endereços estão dentro de `driver_batch_radius_km`. O sistema calcula a rota otimizada e o ganho total.
4. Documentos são armazenados no bucket `driver-docs` do Supabase Storage.
*/

-- 1. Novas colunas em delivery_drivers
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS cnh_number text;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS cnh_category text;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS cnh_image_url text;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS vehicle_plate text;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS vehicle_model text;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS document_url text;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending';
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS verification_notes text;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS wallet_balance numeric NOT NULL DEFAULT 0;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS driver_earnings numeric NOT NULL DEFAULT 0;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS driver_payouts numeric NOT NULL DEFAULT 0;

-- 2. Novas colunas em orders_log
ALTER TABLE orders_log ADD COLUMN IF NOT EXISTS pickup_pin text;
ALTER TABLE orders_log ADD COLUMN IF NOT EXISTS pickup_verified_at timestamptz;
ALTER TABLE orders_log ADD COLUMN IF NOT EXISTS delivery_route_id uuid;
ALTER TABLE orders_log ADD COLUMN IF NOT EXISTS delivery_earnings numeric NOT NULL DEFAULT 0;
ALTER TABLE orders_log ADD COLUMN IF NOT EXISTS route_sequence integer;

-- 3. Novas colunas em business_config
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS driver_fee_per_km numeric NOT NULL DEFAULT 1.50;
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS driver_fee_per_order numeric NOT NULL DEFAULT 3.00;
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS driver_fee_multiplier_batch numeric NOT NULL DEFAULT 0.5;
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS driver_batch_radius_km numeric NOT NULL DEFAULT 2.0;
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS pickup_pin_enabled boolean NOT NULL DEFAULT true;

-- 4. Tabela delivery_routes
CREATE TABLE IF NOT EXISTS delivery_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES delivery_drivers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  total_distance_km numeric NOT NULL DEFAULT 0,
  total_earnings numeric NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  order_count integer NOT NULL DEFAULT 0
);

ALTER TABLE delivery_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_delivery_routes" ON delivery_routes;
CREATE POLICY "anon_select_delivery_routes" ON delivery_routes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_delivery_routes" ON delivery_routes;
CREATE POLICY "anon_insert_delivery_routes" ON delivery_routes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_delivery_routes" ON delivery_routes;
CREATE POLICY "anon_update_delivery_routes" ON delivery_routes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_delivery_routes" ON delivery_routes;
CREATE POLICY "anon_delete_delivery_routes" ON delivery_routes FOR DELETE TO anon, authenticated USING (true);

-- FK de orders_log para delivery_routes (adicionada depois da tabela existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_log_delivery_route_id_fkey'
  ) THEN
    ALTER TABLE orders_log ADD CONSTRAINT orders_log_delivery_route_id_fkey
      FOREIGN KEY (delivery_route_id) REFERENCES delivery_routes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Tabela driver_wallet_transactions
CREATE TABLE IF NOT EXISTS driver_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES delivery_drivers(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric NOT NULL,
  balance_after numeric NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  order_id uuid REFERENCES orders_log(id) ON DELETE SET NULL,
  route_id uuid REFERENCES delivery_routes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE driver_wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_wallet_tx" ON driver_wallet_transactions;
CREATE POLICY "anon_select_wallet_tx" ON driver_wallet_transactions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_wallet_tx" ON driver_wallet_transactions;
CREATE POLICY "anon_insert_wallet_tx" ON driver_wallet_transactions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_wallet_tx" ON driver_wallet_transactions;
CREATE POLICY "anon_update_wallet_tx" ON driver_wallet_transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_wallet_tx" ON driver_wallet_transactions;
CREATE POLICY "anon_delete_wallet_tx" ON driver_wallet_transactions FOR DELETE TO anon, authenticated USING (true);

-- 6. Tabela driver_documents
CREATE TABLE IF NOT EXISTS driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES delivery_drivers(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE driver_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_driver_docs" ON driver_documents;
CREATE POLICY "anon_select_driver_docs" ON driver_documents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_driver_docs" ON driver_documents;
CREATE POLICY "anon_insert_driver_docs" ON driver_documents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_driver_docs" ON driver_documents;
CREATE POLICY "anon_update_driver_docs" ON driver_documents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_driver_docs" ON driver_documents;
CREATE POLICY "anon_delete_driver_docs" ON driver_documents FOR DELETE TO anon, authenticated USING (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_wallet_tx_driver ON driver_wallet_transactions(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_docs_driver ON driver_documents(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_routes_driver ON delivery_routes(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_route ON orders_log(delivery_route_id);

-- Criar bucket de storage para documentos do entregador
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-docs', 'driver-docs', true)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket driver-docs
DROP POLICY IF EXISTS "anon_upload_driver_docs" ON storage.objects;
CREATE POLICY "anon_upload_driver_docs" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'driver-docs');

DROP POLICY IF EXISTS "anon_read_driver_docs" ON storage.objects;
CREATE POLICY "anon_read_driver_docs" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'driver-docs');

DROP POLICY IF EXISTS "anon_delete_driver_docs" ON storage.objects;
CREATE POLICY "anon_delete_driver_docs" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'driver-docs');
