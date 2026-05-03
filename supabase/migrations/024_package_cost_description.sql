-- ============================================================
-- 024_package_cost_description.sql
-- Add cost and description columns to packages table
-- ============================================================

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS cost        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS description TEXT;

NOTIFY pgrst, 'reload schema';
