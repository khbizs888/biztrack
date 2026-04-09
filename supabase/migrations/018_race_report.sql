-- Migration 018: Race Report - Daily Ad Spend tracking
-- Only manual input fields are stored; all performance metrics are computed live
-- from the orders table at query time. No redundant calculated fields stored.

-- ============================================================
-- 1. Create daily_ad_spend table
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_ad_spend (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid          REFERENCES projects(id) NOT NULL,
  date            date          NOT NULL,

  -- Manual input fields only (no calculated fields stored here)
  fb_ad_cost_acc1 numeric(10,2) DEFAULT 0,
  fb_ad_cost_acc2 numeric(10,2) DEFAULT 0,
  fb_ad_cost_acc3 numeric(10,2) DEFAULT 0,
  tiktok_ad_cost  numeric(10,2) DEFAULT 0,
  shopee_ad_cost  numeric(10,2) DEFAULT 0,
  fb_messages     integer       DEFAULT 0,
  goal_sales      numeric(10,2) DEFAULT 0,
  notes           text,
  raw_import_data jsonb,

  -- Source tracking for future API integration
  -- In future: cron job can auto-insert via api_meta / api_tiktok / api_shopee
  -- Manual entry and CSV import are the Phase 1 sources
  source          text          NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual', 'csv_import', 'api_meta', 'api_tiktok', 'api_shopee')),

  created_at      timestamptz   DEFAULT now(),
  updated_at      timestamptz   DEFAULT now(),

  UNIQUE(project_id, date)
);

-- ============================================================
-- 2. Row-Level Security
-- ============================================================

ALTER TABLE daily_ad_spend ENABLE ROW LEVEL SECURITY;

-- Permissive policy: any authenticated user can read/write
CREATE POLICY "daily_ad_spend_authenticated_all"
  ON daily_ad_spend FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Service role bypass
CREATE POLICY "daily_ad_spend_service_all"
  ON daily_ad_spend FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- 3. Auto-update updated_at on row change
-- ============================================================

CREATE OR REPLACE FUNCTION update_daily_ad_spend_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER daily_ad_spend_updated_at
  BEFORE UPDATE ON daily_ad_spend
  FOR EACH ROW EXECUTE FUNCTION update_daily_ad_spend_updated_at();

-- ============================================================
-- 4. Grant permissions
-- ============================================================

GRANT ALL ON daily_ad_spend TO authenticated;
GRANT ALL ON daily_ad_spend TO service_role;

-- Notify PostgREST to reload the schema
NOTIFY pgrst, 'reload schema';
