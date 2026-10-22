/*
# Push subscriptions para notificações push web

1. Nova tabela:
- `push_subscriptions` — armazena endpoints de push web (VAPID) por usuário.
  - `user_id` (uuid) — dono da inscrição (auth.users). Nullable para visitantes anônimos.
  - `endpoint` (text) — URL único do push service.
  - `keys_p256dh` (text) — chave pública do cliente.
  - `keys_auth` (text) — chave de autenticação do cliente.
  - `is_store` (boolean, default false) — se a inscrição é da loja/admin.
  - `created_at` (timestamptz).

2. Segurança:
- RLS habilitado. Cliente lê/salva as próprias; loja (authenticated) lê todas para enviar pushes.
*/

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,
  is_store boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_push_subs" ON push_subscriptions;
CREATE POLICY "read_push_subs" ON push_subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_store = true);

DROP POLICY IF EXISTS "insert_push_subs" ON push_subscriptions;
CREATE POLICY "insert_push_subs" ON push_subscriptions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_push_subs" ON push_subscriptions;
CREATE POLICY "delete_push_subs" ON push_subscriptions FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR is_store = true);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_store ON push_subscriptions(is_store) WHERE is_store = true;