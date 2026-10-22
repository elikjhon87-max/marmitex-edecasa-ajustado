/*
# Horários de cozinha e janela de preparo/entrega

1. Alterações na tabela `business_config` (não remove colunas nem dados)
- `kitchen_open_hours` (text, default '17:00') — hora que a cozinha abre para começar a preparar
- `kitchen_close_hours` (text, default '22:30') — hora que a cozinha para de aceitar preparo
- `prep_start_hours` (text, default '18:00') — hora que começa a preparar os pedidos da noite
- `delivery_start_hours` (text, default '18:30') — hora que começa a despachar para o entregador
- `delivery_end_hours` (text, default '23:00') — hora limite de entrega
2. Segurança
- RLS já habilitado em business_config. Políticas existentes permanecem.
3. Notas
- Todos os ADD COLUMN usam IF NOT EXISTS (idempotente).
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'kitchen_open_hours') THEN
    ALTER TABLE business_config ADD COLUMN kitchen_open_hours text NOT NULL DEFAULT '17:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'kitchen_close_hours') THEN
    ALTER TABLE business_config ADD COLUMN kitchen_close_hours text NOT NULL DEFAULT '22:30';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'prep_start_hours') THEN
    ALTER TABLE business_config ADD COLUMN prep_start_hours text NOT NULL DEFAULT '18:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'delivery_start_hours') THEN
    ALTER TABLE business_config ADD COLUMN delivery_start_hours text NOT NULL DEFAULT '18:30';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'delivery_end_hours') THEN
    ALTER TABLE business_config ADD COLUMN delivery_end_hours text NOT NULL DEFAULT '23:00';
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'lunch_open_hours') THEN
    ALTER TABLE business_config ADD COLUMN lunch_open_hours text NOT NULL DEFAULT '11:00';
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'lunch_close_hours') THEN
    ALTER TABLE business_config ADD COLUMN lunch_close_hours text NOT NULL DEFAULT '15:00';
  END IF;
END $$;