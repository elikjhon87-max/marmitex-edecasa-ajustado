/*
# Add the Medium marmita size

1. Data changes
- Adds the `m` row to `marmita_sizes`.
- Name: Marmita Média.
- Capacity: 650 ml ~ (Fundo Redondo).
- Initial price: R$ 20,00, editable from the admin panel.
- Available by default and placed between Pequena and Grande.

2. Security
- No new table or policy is introduced.
- The existing RLS policies on `marmita_sizes` continue to protect this shared
  single-tenant catalog.

3. Safety
- Uses `ON CONFLICT DO NOTHING` so it can be safely applied again without
  changing a price that the administrator may already have customized.
*/

INSERT INTO marmita_sizes (id, name, capacity, price, display_order, available)
VALUES ('m', 'Marmita Média', '650 ml ~ (Fundo Redondo)', 20.00, 2, true)
ON CONFLICT (id) DO NOTHING;
