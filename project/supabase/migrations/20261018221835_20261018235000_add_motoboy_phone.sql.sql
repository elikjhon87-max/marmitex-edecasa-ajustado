/*
# Add motoboy phone to business_config

1. Modified Tables
- `business_config`: adiciona coluna `motoboy_phone` (text, telefone do motoboy parceiro)
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'motoboy_phone') THEN
    ALTER TABLE business_config ADD COLUMN motoboy_phone text NOT NULL DEFAULT '';
  END IF;
END $$;
