-- Migration 015: Critical Audit Fixes
-- Book/Settle Sales, COD Delivery Tracking, PnL Settings in DB

-- === FIX 1: Book Sales vs Settle Sales View ===
CREATE OR REPLACE VIEW order_sales_metrics AS
SELECT
  id,
  order_date,
  project_id,
  is_cod,
  payment_status,
  status,
  total_price AS book_sales,
  CASE WHEN payment_status = 'Settled' THEN total_price ELSE 0 END AS settle_sales,
  CASE WHEN payment_status = 'Pending' THEN total_price ELSE 0 END AS pending_sales
FROM orders
WHERE status != 'cancelled';

-- === FIX 2: COD Delivery Status ===
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending_delivery';

-- Add check constraint for valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_status_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_delivery_status_check
      CHECK (delivery_status IN ('pending_delivery', 'out_for_delivery', 'delivered', 'returned', 'failed'));
  END IF;
END $$;

-- Set delivery_status for existing orders based on current status/payment_status
UPDATE orders SET delivery_status = 'delivered'
  WHERE (status = 'delivered' OR payment_status = 'Settled')
  AND delivery_status = 'pending_delivery';

-- === FIX 3: PnL Settings Table ===
CREATE TABLE IF NOT EXISTS pnl_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  key text NOT NULL,
  value numeric(10,4) NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, key)
);

-- Enable RLS with permissive policy
ALTER TABLE pnl_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pnl_settings' AND policyname = 'pnl_settings_all'
  ) THEN
    CREATE POLICY "pnl_settings_all" ON pnl_settings
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON pnl_settings TO authenticated, anon;

-- Seed default settings for all existing projects
INSERT INTO pnl_settings (project_id, key, value)
SELECT p.id, s.key, s.value
FROM projects p
CROSS JOIN (
  VALUES
    ('product_cost_pct', 0.30),
    ('shipping_cost_pct', 0.05),
    ('marketing_cost_pct', 0.15),
    ('platform_fee_pct', 0.05),
    ('staff_cost_monthly', 0)
) AS s(key, value)
ON CONFLICT (project_id, key) DO NOTHING;

-- === FIX 4: Add cost column to packages ===
ALTER TABLE packages ADD COLUMN IF NOT EXISTS cost numeric(10,2) DEFAULT 0;

-- === FIX 5: RLS Security (COMMENTED OUT - uncomment when auth is properly implemented) ===
-- WARNING: These revokes will break the app if auth is not fully implemented.
-- Uncomment when you are ready to enforce proper authentication.
-- REVOKE INSERT, UPDATE, DELETE ON orders FROM anon;
-- REVOKE INSERT, UPDATE, DELETE ON customers FROM anon;
-- REVOKE INSERT, UPDATE, DELETE ON inventory FROM anon;
-- REVOKE INSERT, UPDATE, DELETE ON expenses FROM anon;
-- REVOKE INSERT, UPDATE, DELETE ON campaigns FROM anon;
-- REVOKE INSERT, UPDATE, DELETE ON suppliers FROM anon;
