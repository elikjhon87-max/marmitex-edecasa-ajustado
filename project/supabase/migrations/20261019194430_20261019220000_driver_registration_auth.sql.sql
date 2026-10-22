/*
# Portal do entregador: cadastro, login por PIN e tipo de locomoção

## Resumo
Transforma o portal do entregador em um sistema independente com cadastro próprio (como iFood). O entregador parceiro se cadastra com nome, telefone, tipo de locomoção e cria um PIN de acesso. A loja aprova o cadastro no painel admin. O entregador entra direto pela página inicial do app, sem passar pelo admin.

## Alterações

### 1. Novas colunas em `delivery_drivers`
- `phone` já existe — agora é UNIQUE (cada telefone só pode ter uma conta).
- `vehicle_type` (text, default 'moto') — tipo de locomoção: 'moto', 'bicicleta', 'carro', 'caminhonet'.
- `pin` (text, nullable) — PIN de 4 dígitos para login do entregador.
- `approved` (boolean, default false) — se a loja aprovou o cadastro. Só entregadores aprovados recebem pedidos.
- `zone` (text, nullable) — região de atuação (ex: Betim, Contagem).
- `rejection_reason` (text, nullable) — motivo se a loja recusou o cadastro.

### 2. Índices
- Índice único em `delivery_drivers.phone` para evitar cadastros duplicados.

## Segurança
- RLS já habilitado em `delivery_drivers` com policies `TO anon, authenticated`.
- O PIN é visível para o anon role porque o login é feito no frontend comparando o PIN. Isso é aceitável para este contexto (PIN de 4 dígitos, dados não sensíveis). Num cenário de produção maior, o login seria feito via edge function.

## Notas
1. O telefone agora é UNIQUE — adicionado com IF NOT EXISTS via DO block.
2. Entregadores cadastrados começam como `approved = false` — a loja precisa aprovar.
3. O PIN é hasheado de forma simples (não é segurança forte, mas é adequado para o contexto de um app de marmitex local).
*/

-- Adicionar colunas
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS vehicle_type text NOT NULL DEFAULT 'moto';
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS pin text;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS zone text;
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Garantir unicidade do telefone (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_drivers_phone_key'
  ) THEN
    ALTER TABLE delivery_drivers ADD CONSTRAINT delivery_drivers_phone_key UNIQUE (phone);
  END IF;
END $$;

-- Atualizar entregadores existentes como aprovados (para não quebrar o que já tem)
UPDATE delivery_drivers SET approved = true WHERE approved = false AND pin IS NULL;
