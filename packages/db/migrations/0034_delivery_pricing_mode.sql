ALTER TABLE business ADD COLUMN delivery_pricing_mode TEXT NOT NULL DEFAULT 'EXPRESS'
  CHECK (delivery_pricing_mode IN ('EXPRESS', 'AFFILIATED'));
