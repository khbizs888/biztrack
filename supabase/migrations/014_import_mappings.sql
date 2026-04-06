-- 014: Import column mappings + additional order fields

-- ============================================================
-- 1. IMPORT MAPPINGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS import_mappings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  mapping    jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_mappings_created_at
  ON import_mappings(created_at DESC);

-- ============================================================
-- 2. ADDITIONAL ORDER COLUMNS
-- ============================================================

-- courier: shipping carrier parsed from 店铺 column
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS courier TEXT;

-- list_price: FIOR list price (before any discount)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS list_price NUMERIC(10,2);

-- country: recipient country (default MY)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'MY';

-- ============================================================
-- 3. PERMISSIONS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON import_mappings TO authenticated, anon;
GRANT ALL ON import_mappings TO service_role;

GRANT SELECT, INSERT, UPDATE ON orders TO authenticated, anon;
GRANT ALL ON orders TO service_role;

NOTIFY pgrst, 'reload schema';
