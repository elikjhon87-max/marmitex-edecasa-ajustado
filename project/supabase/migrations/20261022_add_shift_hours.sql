DO $$
BEGIN
-- Turnos de Almoço
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'lunch_open_hours') THEN
ALTER TABLE business_config ADD COLUMN lunch_open_hours text NOT NULL DEFAULT '11:00';
END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_config' AND column_name = 'lunch_close_hours') THEN
ALTER TABLE business_config ADD COLUMN lunch_close_hours text NOT NULL DEFAULT '15:00';
END IF;

-- Turnos de Cozinha e Entrega
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
END $$;
