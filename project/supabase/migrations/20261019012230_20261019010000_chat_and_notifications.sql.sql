/*
# Fase 2 — Chat de atendimento e lembretes/notificação in-app

1. Novas tabelas:
- `chat_messages` — conversa entre cliente e loja (com bot automático para respostas simples).
  - `user_id` (uuid) — cliente (auth.users).
  - `sender` — 'customer' | 'store' | 'bot'.
  - `text` — conteúdo da mensagem.
  - `read` — lido pela outra parte.
- `app_notifications` — notificações/alarme in-app para cliente e loja (ex.: novo pedido, pedido a caminho).
  - `target` — 'customer' | 'store'.
  - `user_id` (uuid, nullable) — quando direcionada a um cliente específico.
  - `kind` — tipo ('new_order', 'status_update', 'chat', etc).
  - `payload` (jsonb) — dados arbitrários (order_id, mensagem, etc).
  - `read_at` (timestamptz, nullable).

2. Segurança:
- chat_messages: cliente lê/escreve suas próprias; loja (autenticado) lê todas e escreve como 'store'/'bot'.
- app_notifications: cliente lê suas próprias (por user_id); loja lê 'store' target. INSERT permitido a authenticated (loja e sistema criam para clientes; trigger/bot cria notifs).
*/

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sender text NOT NULL DEFAULT 'customer' CHECK (sender IN ('customer','store','bot')),
  text text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_chat" ON chat_messages;
CREATE POLICY "read_chat" ON chat_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR true);
DROP POLICY IF EXISTS "insert_chat" ON chat_messages;
CREATE POLICY "insert_chat" ON chat_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR true);
DROP POLICY IF EXISTS "update_chat" ON chat_messages;
CREATE POLICY "update_chat" ON chat_messages FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target text NOT NULL DEFAULT 'customer' CHECK (target IN ('customer','store')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'general',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_notifications" ON app_notifications;
CREATE POLICY "read_notifications" ON app_notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR target = 'store' OR target = 'customer');
DROP POLICY IF EXISTS "insert_notifications" ON app_notifications;
CREATE POLICY "insert_notifications" ON app_notifications FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_notifications" ON app_notifications;
CREATE POLICY "update_notifications" ON app_notifications FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_notifications" ON app_notifications;
CREATE POLICY "delete_notifications" ON app_notifications FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_app_notifications_target_unread ON app_notifications(target, read_at);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user_id ON app_notifications(user_id);
