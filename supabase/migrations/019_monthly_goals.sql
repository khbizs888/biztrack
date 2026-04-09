-- Migration 019: Monthly revenue goals per project
-- One row per project per calendar month. Goal is set once per month,
-- not spread across daily_ad_spend rows (which was the old approach).

CREATE TABLE IF NOT EXISTS monthly_goals (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid          REFERENCES projects(id) NOT NULL,
  year           integer       NOT NULL,
  month          integer       NOT NULL CHECK (month BETWEEN 1 AND 12),
  revenue_target numeric(10,2) NOT NULL DEFAULT 0,
  notes          text,
  created_at     timestamptz   DEFAULT now(),
  updated_at     timestamptz   DEFAULT now(),
  UNIQUE(project_id, year, month)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_goals_authenticated_all"
  ON monthly_goals FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "monthly_goals_service_all"
  ON monthly_goals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_monthly_goals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER monthly_goals_updated_at
  BEFORE UPDATE ON monthly_goals
  FOR EACH ROW EXECUTE FUNCTION update_monthly_goals_updated_at();

-- ── Permissions ───────────────────────────────────────────────────────────────

GRANT ALL ON monthly_goals TO authenticated;
GRANT ALL ON monthly_goals TO service_role;

NOTIFY pgrst, 'reload schema';
