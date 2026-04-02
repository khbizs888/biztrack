-- Grant schema usage so PostgREST can see tables at all
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant read access to both roles (needed when RLS is disabled —
-- PostgreSQL falls back to native GRANT checks)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Grant write access to authenticated users
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Sequences (needed for any serial / uuid default columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Apply same grants to any tables created in the future
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- Reload PostgREST schema cache so it picks up these changes immediately
NOTIFY pgrst, 'reload schema';
