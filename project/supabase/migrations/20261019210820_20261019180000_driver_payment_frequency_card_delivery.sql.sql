/*
# Frequência de pagamento do entregador + cartão na entrega

## Resumo
1. Adiciona configuração de frequência de pagamento do entregador (diária, semanal, quinzenal, mensal) com dados para pagamento (chave PIX, tipo de conta, etc).
2. Adiciona "Cartão na entrega" (crédito/débito) como método de pagamento do cliente — sem precisar de API paga, o cliente paga com cartão quando o pedido chega.

## Alterações

### 1. Novas colunas em `delivery_drivers` (dados de pagamento)
- `payment_frequency` (text, default 'weekly') — 'daily', 'weekly', 'biweekly', 'monthly'.
- `pix_key` (text, nullable) — chave PIX do entregador para receber pagamentos.
- `bank_name` (text, nullable) — nome do banco.
- `bank_agency` (text, nullable) — agência.
- `bank_account` (text, nullable) — conta.
- `account_type` (text, nullable) — tipo de conta: 'pix', 'poupanca', 'corrente'.
- `last_payout_at` (timestamptz, nullable) — quando foi o último pagamento.

### 2. Novas colunas em `business_config`
- `card_on_delivery_enabled` (boolean, default true) — se oferece cartão na entrega.
- `card_on_delivery_types` (text, default 'credito,debito') — tipos de cartão aceitos.

## Segurança
- RLS já habilitado em delivery_drivers e business_config. Novas colunas herdam as policies existentes.

## Notas
1. O entregador escolhe a frequência no cadastro ou depois no portal. A loja vê essa info no admin e pode processar pagamentos conforme a frequência escolhida.
2. Cartão na entrega é uma opção de pagamento sem API — o cliente escolhe e paga com cartão物理mente quando o pedido chega.
*/

ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS payment_frequency text NOT NULL DEFAULT 'weekly';
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS pix_key text;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS bank_agency text;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS account_type text;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS last_payout_at timestamptz;

ALTER TABLE business_config ADD COLUMN IF NOT EXISTS card_on_delivery_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS card_on_delivery_types text NOT NULL DEFAULT 'credito,debito';
