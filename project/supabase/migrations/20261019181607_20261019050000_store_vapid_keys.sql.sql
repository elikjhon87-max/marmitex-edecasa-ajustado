/*
# Store VAPID keys for web push

1. Alter `business_config`:
- `vapid_public_key` (text, nullable) — chave pública VAPID para push web.
- `vapid_private_key` (text, nullable) — chave privada VAPID (lida só pelo edge function via service role).

2. Segurança:
- RLS já habilitado em business_config. A chave privada é acessível apenas via service role (edge function), não pelo anon key.
- Não adicionamos política nova; a política SELECT existente continua permitindo leitura geral da config.
- Na prática, a chave privada é lida apenas no edge function com SUPABASE_SERVICE_ROLE_KEY.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'vapid_public_key') THEN
    ALTER TABLE business_config ADD COLUMN vapid_public_key text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'vapid_private_key') THEN
    ALTER TABLE business_config ADD COLUMN vapid_private_key text;
  END IF;
END $$;

-- Store the VAPID keys in the config row.
UPDATE business_config
SET vapid_public_key = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE2b7tAeyzCWvQvi0GpSfKpMtuX13duNC-FpZw8m2BkJ_7MQJ8oh4-kB_wBbBeCMu1nqO85-_2axzhXZ0aaNWX5Q',
    vapid_private_key = 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg1r71usEs6W53NAvT5SCGcjU2ML9InNk4V_Ps0a5Bs-uhRANCAATZvu0B7LMJa9C-LQalJ8qky25fXd240L4WlnDybYGQn_sxAnyiHj6QH_AFsF4Iy7Weo7zn7_ZrHOFdnRpo1Zfl'
WHERE id = 1;