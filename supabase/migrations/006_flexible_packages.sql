-- ============================================================
-- 006_flexible_packages.sql
-- Flexible package schema, attribute definitions, order linking
-- ============================================================

-- 1. Extend packages table with new columns
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS code              TEXT,
  ADD COLUMN IF NOT EXISTS custom_attributes JSONB        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active         BOOLEAN      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order        INTEGER      NOT NULL DEFAULT 0;

-- Unique SKU code scoped per project (NULLs are not constrained)
CREATE UNIQUE INDEX IF NOT EXISTS idx_packages_project_code
  ON packages(project_id, code)
  WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_packages_project_active
  ON packages(project_id, is_active);

-- 2. Per-project custom attribute schema for packages
CREATE TABLE IF NOT EXISTS package_attributes_schema (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  attribute_key   TEXT        NOT NULL,
  attribute_label TEXT        NOT NULL,
  attribute_type  TEXT        NOT NULL CHECK (attribute_type IN ('text','number','boolean','select')),
  options         JSONB       NOT NULL DEFAULT '[]',
  is_required     BOOLEAN     NOT NULL DEFAULT false,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, attribute_key)
);

CREATE INDEX IF NOT EXISTS idx_attr_schema_project_id
  ON package_attributes_schema(project_id);

-- 3. Link orders to packages (nullable — existing orders unaffected)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES packages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_package_id ON orders(package_id);

-- 4. Permissions
GRANT SELECT                   ON package_attributes_schema TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE   ON package_attributes_schema TO authenticated;
GRANT ALL                      ON package_attributes_schema TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
