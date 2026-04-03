-- 008: Link products ↔ packages
-- products.project_id already exists (migration 001)
-- Add product_id to packages so each package references a specific product

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_packages_product_id ON packages(product_id);

GRANT UPDATE (product_id) ON packages TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
