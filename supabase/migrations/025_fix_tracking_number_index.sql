-- ============================================================
-- 025_fix_tracking_number_index.sql
-- Ensure tracking_number unique index is partial (NULLs excluded).
--
-- Migration 020 created a plain non-partial index with the same name,
-- which could shadow the partial unique index from 011 in some
-- environments. Drop both and recreate as a single partial unique index
-- so multiple NULL tracking_numbers are allowed while non-NULL values
-- remain globally unique.
-- ============================================================

DROP INDEX IF EXISTS idx_orders_tracking_number;

CREATE UNIQUE INDEX idx_orders_tracking_number
  ON orders (tracking_number)
  WHERE tracking_number IS NOT NULL;

NOTIFY pgrst, 'reload schema';
