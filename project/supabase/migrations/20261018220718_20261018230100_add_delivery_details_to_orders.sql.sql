/*
# Add delivery details to orders_log

1. Modified Tables
- `orders_log`: adiciona colunas
  - `delivery_fee` (numeric, taxa de entrega do pedido)
  - `delivery_zone` (text, nome da zona/bairro selecionada)
  - `needs_motoboy` (boolean, se solicitou motoboy)
  - `estimated_ready_at` (text, horário estimado de pronto)
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders_log' AND column_name = 'delivery_fee') THEN
    ALTER TABLE orders_log ADD COLUMN delivery_fee numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders_log' AND column_name = 'delivery_zone') THEN
    ALTER TABLE orders_log ADD COLUMN delivery_zone text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders_log' AND column_name = 'needs_motoboy') THEN
    ALTER TABLE orders_log ADD COLUMN needs_motoboy boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders_log' AND column_name = 'estimated_ready_at') THEN
    ALTER TABLE orders_log ADD COLUMN estimated_ready_at text NOT NULL DEFAULT '';
  END IF;
END $$;
