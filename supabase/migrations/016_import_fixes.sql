-- Migration 016: Import Fixes
-- 1. Make phone optional on customers
-- 2. Drop old unique constraint on phone (replaced with partial unique index)
-- 3. Backfill orphaned orders by tracking_number prefix

-- ============================================================
-- 1. DROP NOT NULL on customers.phone
-- ============================================================

ALTER TABLE customers ALTER COLUMN phone DROP NOT NULL;

-- ============================================================
-- 2. Replace unique constraint on phone with a partial unique index
--    that only applies when phone IS NOT NULL and not empty string.
--    This allows multiple customers without a phone number.
-- ============================================================

-- Drop the old constraint if it exists as a real constraint (from initial schema)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_phone_key'
      AND conrelid = 'customers'::regclass
  ) THEN
    ALTER TABLE customers DROP CONSTRAINT customers_phone_key;
  END IF;
END $$;

-- Drop old index if it was created as a plain unique index
DROP INDEX IF EXISTS customers_phone_key;
DROP INDEX IF EXISTS customers_phone_unique;

-- Create partial unique index: unique only when phone has a real value
CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique
  ON customers(phone)
  WHERE phone IS NOT NULL AND phone != '';

-- ============================================================
-- 3. Add import_error and import_status columns to orders (if not present)
--    import_status: 'success' | 'warning' | 'error'
--    import_error: text describing what went wrong (e.g. unmatched package)
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS import_status TEXT DEFAULT 'success';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS import_error  TEXT;

-- ============================================================
-- 4. Backfill orphaned orders by tracking_number prefix
-- ============================================================

UPDATE orders
SET project_id = (SELECT id FROM projects WHERE name = 'Juji' LIMIT 1)
WHERE project_id IS NULL
  AND tracking_number LIKE 'Juji%';

UPDATE orders
SET project_id = (SELECT id FROM projects WHERE name = 'FIOR' LIMIT 1)
WHERE project_id IS NULL
  AND tracking_number LIKE 'Fior%';

UPDATE orders
SET project_id = (SELECT id FROM projects WHERE name = 'DD' LIMIT 1)
WHERE project_id IS NULL
  AND tracking_number LIKE 'DD%';

UPDATE orders
SET project_id = (SELECT id FROM projects WHERE name = 'KHH' LIMIT 1)
WHERE project_id IS NULL
  AND tracking_number LIKE 'KHH%';

UPDATE orders
SET project_id = (SELECT id FROM projects WHERE name = 'NE' LIMIT 1)
WHERE project_id IS NULL
  AND tracking_number LIKE 'NE%';

-- ============================================================
-- 5. Grant permissions
-- ============================================================

NOTIFY pgrst, 'reload schema';
