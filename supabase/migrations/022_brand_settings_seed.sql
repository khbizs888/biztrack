-- Ensure brand_settings table exists (idempotent)
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'brand_settings' AND policyname = 'brand_settings_open'
  ) THEN
    CREATE POLICY "brand_settings_open" ON brand_settings
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed default rows for any projects that don't have one yet
INSERT INTO brand_settings (project_id, vip_spend_threshold, vip_order_threshold, retention_days, inactive_days)
SELECT id, 2000, 6, 365, 365 FROM projects
ON CONFLICT (project_id) DO NOTHING;
