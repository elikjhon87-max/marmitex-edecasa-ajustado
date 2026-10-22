/*
# Estender tabela suppliers para a ferramenta Buscar Fornecedores

1. Alterações na tabela `suppliers` (NÃO remove colunas nem dados existentes)
- `category` (text, default '') — categoria do fornecedor (carnes, hortifruti, mercearia, etc.)
- `contact_name` (text, default '') — nome do contato
- `phone` (text, default '') — telefone
- `whatsapp` (text, default '') — número de WhatsApp
- `city` (text, default '') — cidade
- `maps_link` (text, default '') — link do Google Maps
- `products` (text, default '') — produtos fornecidos
- `favorite` (boolean, default false) — marcado como favorito
2. Segurança
- RLS já está habilitado em `suppliers`. As políticas existentes (anon + authenticated CRUD) 
  já permitem o acesso da aplicação. Nenhuma alteração de política é necessária.
3. Notas
- Todos os ADD COLUMN usam IF NOT EXISTS para serem idempotentes.
- Os fornecedores e preços já cadastrados são preservados.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'category') THEN
    ALTER TABLE suppliers ADD COLUMN category text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'contact_name') THEN
    ALTER TABLE suppliers ADD COLUMN contact_name text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'phone') THEN
    ALTER TABLE suppliers ADD COLUMN phone text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'whatsapp') THEN
    ALTER TABLE suppliers ADD COLUMN whatsapp text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'city') THEN
    ALTER TABLE suppliers ADD COLUMN city text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'maps_link') THEN
    ALTER TABLE suppliers ADD COLUMN maps_link text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'products') THEN
    ALTER TABLE suppliers ADD COLUMN products text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'favorite') THEN
    ALTER TABLE suppliers ADD COLUMN favorite boolean NOT NULL DEFAULT false;
  END IF;
END $$;