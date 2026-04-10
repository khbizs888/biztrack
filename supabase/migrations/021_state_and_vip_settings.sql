-- Add state and address to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address text;
CREATE INDEX IF NOT EXISTS idx_orders_state ON orders(state);

-- Create brand_settings table
CREATE TABLE IF NOT EXISTS brand_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) UNIQUE NOT NULL,
  vip_spend_threshold numeric(10,2) DEFAULT 2000,
  vip_order_threshold integer DEFAULT 6,
  retention_days integer DEFAULT 365,
  inactive_days integer DEFAULT 365,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE brand_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand_settings_open" ON brand_settings
  FOR ALL USING (true) WITH CHECK (true);

-- Seed with all projects using default values
INSERT INTO brand_settings (project_id)
SELECT id FROM projects
ON CONFLICT (project_id) DO NOTHING;

-- Backfill state from raw_import_data
UPDATE orders
SET state = raw_import_data->>'State'
WHERE state IS NULL
  AND raw_import_data->>'State' IS NOT NULL
  AND raw_import_data->>'State' != '';
