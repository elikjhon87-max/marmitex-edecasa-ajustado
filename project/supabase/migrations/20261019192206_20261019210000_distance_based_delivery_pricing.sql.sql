/*
# Cálculo de entrega por distância real (rota de carro)

## Resumo
Adiciona a capacidade de calcular o preço da entrega com base na distância real de carro entre a loja e o endereço do cliente (não em linha reta). Usa geocodificação (Nominatim/OpenStreetMap) + roteamento de carro (OSRM) numa edge function. Mantém o sistema de regiões com taxa fixa como alternativa — o admin pode escolher o modo.

## Alterações

### 1. Novas colunas em `business_config`
- `delivery_pricing_mode` (text, default 'fixed') — 'fixed' usa as regiões com taxa fixa; 'distance' calcula pela distância de carro.
- `delivery_price_per_km` (numeric, default 2.00) — preço por km rodado.
- `delivery_base_fee` (numeric, default 5.00) — taxa base (cobrada sempre que há entrega por distância).
- `delivery_free_km` (numeric, default 0) — km de graça (ex: 2 = grátis até 2 km, depois cobra por km extra).
- `delivery_max_km` (numeric, default 15) — distância máxima de entrega em km.
- `store_lat` (double precision, nullable) — latitude da loja (geocodificada automaticamente).
- `store_lng` (double precision, nullable) — longitude da loja.

### 2. Nova tabela `geocode_cache`
- `id` (uuid, primary key)
- `address_key` (text, unique) — endereço normalizado em minúsculas
- `lat` (double precision) — latitude
- `lng` (double precision) — longitude
- `formatted_address` (text) — endereço formatado retornado pelo geocoder
- `created_at` (timestamptz, default now())

## Segurança
- RLS habilitado em `geocode_cache` com policies `TO anon, authenticated` (cache compartilhado, leitura/escrita livre para evitar chamadas repetidas ao geocoder).
- As colunas em `business_config` herdam as policies existentes.

## Notas
1. O cache evita chamadas repetidas ao Nominatim, que tem limite de 1 req/segundo.
2. As coordenadas da loja são geocodificadas pela edge function na primeira vez e salvas em `store_lat`/`store_lng`.
3. O modo 'fixed' mantém o comportamento atual (regiões com taxa fixa). O modo 'distance' ignora as regiões e calcula pela distância.
*/

-- 1. Novas colunas em business_config
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS delivery_pricing_mode text NOT NULL DEFAULT 'fixed';
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS delivery_price_per_km numeric NOT NULL DEFAULT 2.00;
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS delivery_base_fee numeric NOT NULL DEFAULT 5.00;
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS delivery_free_km numeric NOT NULL DEFAULT 0;
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS delivery_max_km numeric NOT NULL DEFAULT 15;
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS store_lat double precision;
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS store_lng double precision;

-- 2. Tabela geocode_cache
CREATE TABLE IF NOT EXISTS geocode_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_key text UNIQUE NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  formatted_address text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE geocode_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_geocode_cache" ON geocode_cache;
CREATE POLICY "anon_select_geocode_cache" ON geocode_cache FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_geocode_cache" ON geocode_cache;
CREATE POLICY "anon_insert_geocode_cache" ON geocode_cache FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_geocode_cache" ON geocode_cache;
CREATE POLICY "anon_update_geocode_cache" ON geocode_cache FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_geocode_cache" ON geocode_cache;
CREATE POLICY "anon_delete_geocode_cache" ON geocode_cache FOR DELETE
  TO anon, authenticated USING (true);
