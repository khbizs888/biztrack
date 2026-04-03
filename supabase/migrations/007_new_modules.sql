-- 007: New modules — Product Catalog, Expense Tracker, Inventory, Suppliers, Campaigns

-- ============================================================
-- 1. ENHANCE PRODUCTS TABLE (add new catalog fields)
-- ============================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brand         TEXT,
  ADD COLUMN IF NOT EXISTS category      TEXT,
  ADD COLUMN IF NOT EXISTS unit_cost     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS selling_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS weight_g      NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS platform      TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status        TEXT DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS description   TEXT,
  ADD COLUMN IF NOT EXISTS image_url     TEXT,
  ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT now();

-- Add unique constraint on sku if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_sku_unique'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_sku_unique UNIQUE (sku);
  END IF;
END $$;

-- ============================================================
-- 2. ENHANCE EXPENSES TABLE (add new tracker fields)
-- ============================================================
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS category       TEXT,
  ADD COLUMN IF NOT EXISTS brand          TEXT,
  ADD COLUMN IF NOT EXISTS description    TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Bank Transfer',
  ADD COLUMN IF NOT EXISTS receipt_url    TEXT,
  ADD COLUMN IF NOT EXISTS recurring      BOOLEAN DEFAULT false;

-- ============================================================
-- 3. INVENTORY TRACKING
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('Stock In', 'Stock Out', 'Adjustment')),
  quantity    INTEGER     NOT NULL,
  reference   TEXT,
  notes       TEXT,
  date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_date       ON inventory(date);

-- Inventory summary view: current stock per product
CREATE OR REPLACE VIEW inventory_summary AS
SELECT
  p.id    AS product_id,
  p.sku,
  p.name  AS product_name,
  p.brand,
  COALESCE(SUM(
    CASE i.type
      WHEN 'Stock In'   THEN  i.quantity
      WHEN 'Stock Out'  THEN -i.quantity
      WHEN 'Adjustment' THEN  i.quantity
      ELSE 0
    END
  ), 0) AS current_stock
FROM products p
LEFT JOIN inventory i ON i.product_id = p.id
GROUP BY p.id, p.sku, p.name, p.brand;

-- ============================================================
-- 4. SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  contact_person    TEXT,
  phone             TEXT,
  email             TEXT,
  products_supplied TEXT        NOT NULL DEFAULT '',
  lead_time_days    INTEGER,
  payment_terms     TEXT,
  notes             TEXT,
  status            TEXT        NOT NULL DEFAULT 'Active',
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);

-- ============================================================
-- 5. MARKETING CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT          NOT NULL,
  platform          TEXT          NOT NULL,
  brand             TEXT          NOT NULL,
  budget            NUMERIC(10,2) NOT NULL DEFAULT 0,
  spent             NUMERIC(10,2) NOT NULL DEFAULT 0,
  start_date        DATE          NOT NULL,
  end_date          DATE,
  status            TEXT          NOT NULL DEFAULT 'Draft',
  objective         TEXT          NOT NULL DEFAULT 'Sales',
  target_product_id UUID          REFERENCES products(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_brand  ON campaigns(brand);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- ============================================================
-- 6. RLS POLICIES (permissive — no strict auth requirement yet)
-- ============================================================
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_select" ON inventory FOR SELECT USING (true);
CREATE POLICY "inventory_insert" ON inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "inventory_update" ON inventory FOR UPDATE USING (true);
CREATE POLICY "inventory_delete" ON inventory FOR DELETE USING (true);

CREATE POLICY "suppliers_select" ON suppliers FOR SELECT USING (true);
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT WITH CHECK (true);
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE USING (true);
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE USING (true);

CREATE POLICY "campaigns_select" ON campaigns FOR SELECT USING (true);
CREATE POLICY "campaigns_insert" ON campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "campaigns_update" ON campaigns FOR UPDATE USING (true);
CREATE POLICY "campaigns_delete" ON campaigns FOR DELETE USING (true);

-- Relax existing products / expenses policies for the new catalog UI
DROP POLICY IF EXISTS "products_insert"     ON products;
DROP POLICY IF EXISTS "products_update"     ON products;
DROP POLICY IF EXISTS "products_delete"     ON products;
CREATE POLICY "products_insert_open" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "products_update_open" ON products FOR UPDATE USING (true);
CREATE POLICY "products_delete_open" ON products FOR DELETE USING (true);

DROP POLICY IF EXISTS "expenses_insert"     ON expenses;
DROP POLICY IF EXISTS "expenses_update"     ON expenses;
DROP POLICY IF EXISTS "expenses_delete"     ON expenses;
CREATE POLICY "expenses_insert_open" ON expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "expenses_update_open" ON expenses FOR UPDATE USING (true);
CREATE POLICY "expenses_delete_open" ON expenses FOR DELETE USING (true);

-- ============================================================
-- 7. PERMISSIONS
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory  TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON suppliers  TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON campaigns  TO authenticated, anon;
GRANT SELECT                         ON inventory_summary TO authenticated, anon;
GRANT ALL                            ON inventory  TO service_role;
GRANT ALL                            ON suppliers  TO service_role;
GRANT ALL                            ON campaigns  TO service_role;

NOTIFY pgrst, 'reload schema';
