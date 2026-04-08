-- Migration 017: Auto Order ID generation for DD, Juji, NE brands

-- ============================================================
-- 1. Create order_sequences table
-- ============================================================

CREATE TABLE IF NOT EXISTS order_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) UNIQUE NOT NULL,
  prefix text NOT NULL,
  current_number integer NOT NULL DEFAULT 0,
  year integer NOT NULL DEFAULT 2026
);

-- ============================================================
-- 2. Seed sequences for all 5 projects
-- ============================================================

INSERT INTO order_sequences (project_id, prefix, current_number, year)
SELECT p.id, 'FIOR',
  COALESCE((
    SELECT MAX(CAST(REGEXP_REPLACE(tracking_number, '[^0-9]', '', 'g') AS integer))
    FROM orders
    WHERE tracking_number LIKE 'Fior%' AND tracking_number ~ '[0-9]+'
  ), 0),
  2026
FROM projects p WHERE p.name = 'FIOR'
ON CONFLICT (project_id) DO UPDATE SET
  prefix = EXCLUDED.prefix,
  current_number = EXCLUDED.current_number;

INSERT INTO order_sequences (project_id, prefix, current_number, year)
SELECT p.id, 'JUJI',
  COALESCE((
    SELECT COUNT(*) FROM orders WHERE project_id = p.id AND tracking_number LIKE 'JUJI%'
  ), 0),
  2026
FROM projects p WHERE p.name = 'Juji'
ON CONFLICT (project_id) DO UPDATE SET prefix = EXCLUDED.prefix, current_number = EXCLUDED.current_number;

INSERT INTO order_sequences (project_id, prefix, current_number, year)
SELECT p.id, 'DD',
  COALESCE((SELECT COUNT(*) FROM orders WHERE project_id = p.id AND tracking_number LIKE 'DD%'), 0),
  2026
FROM projects p WHERE p.name = 'DD'
ON CONFLICT (project_id) DO UPDATE SET prefix = EXCLUDED.prefix, current_number = EXCLUDED.current_number;

INSERT INTO order_sequences (project_id, prefix, current_number, year)
SELECT p.id, 'KHH',
  COALESCE((SELECT COUNT(*) FROM orders WHERE project_id = p.id AND tracking_number LIKE 'KHH%'), 0),
  2026
FROM projects p WHERE p.name = 'KHH'
ON CONFLICT (project_id) DO UPDATE SET prefix = EXCLUDED.prefix, current_number = EXCLUDED.current_number;

INSERT INTO order_sequences (project_id, prefix, current_number, year)
SELECT p.id, 'NE',
  COALESCE((SELECT COUNT(*) FROM orders WHERE project_id = p.id AND tracking_number LIKE 'NE%'), 0),
  2026
FROM projects p WHERE p.name = 'NE'
ON CONFLICT (project_id) DO UPDATE SET prefix = EXCLUDED.prefix, current_number = EXCLUDED.current_number;

-- ============================================================
-- 3. Create atomic increment function
-- ============================================================

CREATE OR REPLACE FUNCTION generate_order_id(p_project_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix text;
  v_year integer;
  v_number integer;
  v_current_year integer;
BEGIN
  v_current_year := EXTRACT(YEAR FROM NOW())::integer;

  -- Lock the row and increment
  UPDATE order_sequences
  SET
    current_number = CASE
      WHEN year != v_current_year THEN 1  -- year rollover: reset to 1
      ELSE current_number + 1
    END,
    year = v_current_year
  WHERE project_id = p_project_id
  RETURNING prefix, year, current_number INTO v_prefix, v_year, v_number;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No sequence found for project_id %', p_project_id;
  END IF;

  -- Format: PREFIX + YEAR + 6-digit padded number
  RETURN v_prefix || v_year::text || LPAD(v_number::text, 6, '0');
END;
$$;

-- ============================================================
-- 4. Backfill Juji orders that have NULL or non-JUJI tracking numbers
-- ============================================================

DO $$
DECLARE
  v_order record;
  v_seq integer := 0;
  v_project_id uuid;
BEGIN
  SELECT id INTO v_project_id FROM projects WHERE name = 'Juji';

  -- Update orders that need backfill (NULL tracking or not starting with JUJI)
  FOR v_order IN
    SELECT id FROM orders
    WHERE project_id = v_project_id
    AND (tracking_number IS NULL OR tracking_number = '' OR NOT tracking_number LIKE 'JUJI%')
    ORDER BY created_at ASC
  LOOP
    v_seq := v_seq + 1;
    UPDATE orders SET tracking_number = 'JUJI2026' || LPAD(v_seq::text, 6, '0')
    WHERE id = v_order.id;
  END LOOP;

  -- Update sequence to reflect backfilled orders
  UPDATE order_sequences SET current_number = v_seq
  WHERE project_id = v_project_id AND v_seq > 0;
END;
$$;

-- ============================================================
-- 5. Grant permissions
-- ============================================================

NOTIFY pgrst, 'reload schema';
