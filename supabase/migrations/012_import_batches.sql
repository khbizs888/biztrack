-- 012: Import batch tracking
-- Creates import_batches table and links orders to batches

-- ============================================================
-- 1. CREATE import_batches TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS import_batches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  file_name     text,
  total_rows    integer DEFAULT 0,
  success_count integer DEFAULT 0,
  skipped_count integer DEFAULT 0,
  error_count   integer DEFAULT 0,
  status        text DEFAULT 'processing',
  imported_at   timestamptz DEFAULT now(),
  completed_at  timestamptz,
  notes         text
);

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON import_batches FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 2. ADD import_batch_id TO orders
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES import_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_import_batch_id ON orders(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_project_id ON import_batches(project_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_imported_at ON import_batches(imported_at);

-- ============================================================
-- 3. PERMISSIONS
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON import_batches TO authenticated, anon;
GRANT ALL ON import_batches TO service_role;

NOTIFY pgrst, 'reload schema';
