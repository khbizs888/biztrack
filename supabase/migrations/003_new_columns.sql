-- Add new columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fb_name TEXT,
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS purchase_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_new_customer BOOLEAN DEFAULT true;

-- Package items junction table (products inside a package)
CREATE TABLE IF NOT EXISTS package_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id  UUID REFERENCES packages(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_package_items_package_id ON package_items(package_id);
CREATE INDEX IF NOT EXISTS idx_package_items_product_id ON package_items(product_id);

-- RLS for package_items
ALTER TABLE package_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read package_items"
  ON package_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert package_items"
  ON package_items FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete package_items"
  ON package_items FOR DELETE
  USING (is_admin());
