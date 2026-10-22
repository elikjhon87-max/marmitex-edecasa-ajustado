/*
# Create payment_sessions table for Stripe checkout tracking

1. New Tables
- `payment_sessions`
  - `id` (uuid, primary key)
  - `stripe_session_id` (text, unique, nullable until checkout is created)
  - `status` (text: pending | paid | expired, default 'pending')
  - `amount` (numeric, total in BRL)
  - `customer_name` (text)
  - `customer_phone` (text)
  - `customer_address` (text)
  - `order_details` (jsonb: the full order selection for display)
  - `whatsapp_message` (text: the preformatted WhatsApp message, sent after payment)
  - `payment_method` (text: card | pix)
  - `created_at` (timestamptz)
  - `paid_at` (timestamptz, nullable)

2. Security
- Enable RLS on `payment_sessions`.
- SELECT only for anon + authenticated so the frontend can look up its own
  payment status by id. INSERT/UPDATE/DELETE are NOT exposed to anon: all writes
  happen through edge functions using the service role key (bypasses RLS).
- This is a single-tenant storefront with no customer sign-in, so reads are
  intentionally public by id.

3. Notes
- The edge functions `create-checkout` and `verify-checkout` use the
  SUPABASE_SERVICE_ROLE_KEY to insert and update rows, so no anon write policies
  are needed.
*/

CREATE TABLE IF NOT EXISTS payment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired')),
  amount numeric(10,2) NOT NULL DEFAULT 0,
  customer_name text,
  customer_phone text,
  customer_address text,
  order_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  whatsapp_message text NOT NULL DEFAULT '',
  payment_method text NOT NULL DEFAULT 'card',
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

ALTER TABLE payment_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_payment_sessions" ON payment_sessions;
CREATE POLICY "anon_select_payment_sessions" ON payment_sessions
  FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_stripe_session_id
  ON payment_sessions (stripe_session_id);
