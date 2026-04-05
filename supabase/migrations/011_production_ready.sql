-- 011: Production-ready order system
-- Adds snapshot, cost tracking, profit, import status, and tracking number dedup

-- ============================================================
-- 1. EXTEND ORDERS TABLE
-- ============================================================

-- package_snapshot: frozen copy of package at order time
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS package_snapshot JSONB;

-- cost_price: from package cost at order time
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) DEFAULT 0;

-- profit: calculated field
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS profit NUMERIC(10,2) DEFAULT 0;

-- import_status: tracks import pipeline result
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS import_status TEXT DEFAULT 'success';

-- import_error: error message if import failed
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS import_error TEXT;

-- tracking_number: unique per order (NULL allowed = multiple NULLs OK)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_number TEXT;

-- shipping_fee: per-order shipping cost
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10,2) DEFAULT 0;

-- handling_fee: per-order handling/COD fee
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS handling_fee NUMERIC(10,2) DEFAULT 0;

-- is_cod: cash on delivery flag
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_cod BOOLEAN DEFAULT false;

-- payment_status: Pending, Settled
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';

-- settled_at: when payment was settled
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

-- quantity: order quantity (defaults to 1)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- ============================================================
-- 2. UNIQUE CONSTRAINT on tracking_number (nulls excluded)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking_number
  ON orders(tracking_number)
  WHERE tracking_number IS NOT NULL;

-- ============================================================
-- 3. BACKFILL EXISTING ORDERS
-- ============================================================

-- 3a. Backfill project_id from package
UPDATE orders
SET project_id = pkg.project_id
FROM packages pkg
WHERE orders.package_id = pkg.id
  AND orders.project_id IS NULL;

-- 3b. Backfill package_snapshot
UPDATE orders
SET package_snapshot = jsonb_build_object(
  'name', pkg.name,
  'price', pkg.price,
  'code', pkg.code
)
FROM packages pkg
WHERE orders.package_id = pkg.id
  AND orders.package_snapshot IS NULL;

-- 3c. Set cost_price default
UPDATE orders
SET cost_price = 0
WHERE cost_price IS NULL;

-- 3d. Recalculate profit for existing orders
UPDATE orders
SET profit = COALESCE(total_price, 0)
           - COALESCE(cost_price, 0)
           - COALESCE(shipping_fee, 0)
           - COALESCE(handling_fee, 0)
WHERE profit IS NULL OR profit = 0;

-- ============================================================
-- 4. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_import_status ON orders(import_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_is_cod ON orders(is_cod);

-- ============================================================
-- 5. PERMISSIONS
-- ============================================================
GRANT SELECT, INSERT, UPDATE ON orders TO authenticated, anon;
GRANT ALL ON orders TO service_role;

NOTIFY pgrst, 'reload schema';
