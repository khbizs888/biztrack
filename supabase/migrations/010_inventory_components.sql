-- 010: Component-based inventory system
-- Replaces product-based inventory with BOM component tracking per brand

-- ============================================================
-- 1. COMPONENT REGISTRY
-- ============================================================
CREATE TABLE IF NOT EXISTS component_registry (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand        TEXT        NOT NULL,
  json_key     TEXT        NOT NULL,   -- matches key in packages.custom_attributes
  display_name TEXT        NOT NULL,
  unit         TEXT        NOT NULL,   -- Box, Bottle, Sachet, Tin, Shaker, Pack, Piece
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (brand, json_key)
);

ALTER TABLE component_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "component_registry_select" ON component_registry FOR SELECT USING (true);
CREATE POLICY "component_registry_insert" ON component_registry FOR INSERT WITH CHECK (true);
CREATE POLICY "component_registry_update" ON component_registry FOR UPDATE USING (true);
CREATE POLICY "component_registry_delete" ON component_registry FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON component_registry TO authenticated, anon;
GRANT ALL ON component_registry TO service_role;

-- ============================================================
-- 2. SEED COMPONENT REGISTRY
-- ============================================================
INSERT INTO component_registry (brand, json_key, display_name, unit) VALUES
  -- DD
  ('DD',   'dd_boxes',            'DD Box',              'Box'),
  ('DD',   'dd_bottle_amount',    'DD Bottle',           'Bottle'),
  ('DD',   'dd_sachet',           'DD Sachet',           'Sachet'),
  ('DD',   'cactus_gel_l_bottle', 'Cactus Gel L Bottle', 'Bottle'),
  ('DD',   'cactus_gel_s_bottle', 'Cactus Gel S Bottle', 'Bottle'),
  ('DD',   'coin',                'Coin',                'Piece'),
  -- Juji
  ('Juji', 'juji_box',            'Juji Box',            'Box'),
  ('Juji', 'juji_tin',            'Juji Tin',            'Tin'),
  ('Juji', 'juji_sachet',         'Juji Sachet',         'Sachet'),
  ('Juji', 'juji_shaker',         'Juji Shaker',         'Shaker'),
  ('Juji', 'juji_multi_tin',      'Juji Multi Tin',      'Tin'),
  ('Juji', 'juji_multii_pack',    'Juji Multi Pack',     'Pack'),
  -- KHH
  ('KHH',  'khh_boxes',           'KHH Box',             'Box'),
  ('KHH',  'khh_sachet',          'KHH Sachet',          'Sachet'),
  -- NE
  ('NE',   'ne_boxes',            'NE Box',              'Box'),
  ('NE',   'ne_sachet',           'NE Sachet',           'Sachet'),
  ('NE',   'eatox',               'Eatox',               'Box'),
  ('NE',   'spa_water',           'Spa Water',           'Bottle'),
  ('NE',   'beauty_powder',       'Beauty Powder',       'Pack'),
  ('NE',   'itscoll_plus_se',     'ItsCollagen Plus SE', 'Pack'),
  ('NE',   'itscoll_cactus_gel',  'ItsCollagen Cactus Gel', 'Bottle'),
  ('NE',   'angpao',              'Angpao',              'Piece'),
  -- FIOR
  ('FIOR', 'box_count',           'FIOR Box',            'Box')
ON CONFLICT (brand, json_key) DO NOTHING;

-- ============================================================
-- 3. UPDATE INVENTORY TABLE
--    Make product_id nullable (inventory is now component-based)
--    Add component_key + brand columns
-- ============================================================
ALTER TABLE inventory
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS component_key TEXT,
  ADD COLUMN IF NOT EXISTS brand         TEXT;

CREATE INDEX IF NOT EXISTS idx_inventory_brand_component ON inventory(brand, component_key);

-- ============================================================
-- 4. REBUILD INVENTORY SUMMARY VIEW
--    Group by brand + component_key, join component_registry
-- ============================================================
DROP VIEW IF EXISTS inventory_summary;

CREATE OR REPLACE VIEW inventory_summary AS
SELECT
  cr.brand,
  cr.json_key     AS component_key,
  cr.display_name,
  cr.unit,
  COALESCE(SUM(
    CASE i.type
      WHEN 'Stock In'   THEN  i.quantity
      WHEN 'Stock Out'  THEN -i.quantity
      WHEN 'Adjustment' THEN  i.quantity
      ELSE 0
    END
  ), 0) AS current_stock
FROM component_registry cr
LEFT JOIN inventory i
  ON i.brand = cr.brand
 AND i.component_key = cr.json_key
GROUP BY cr.brand, cr.json_key, cr.display_name, cr.unit
ORDER BY cr.brand, cr.display_name;

GRANT SELECT ON inventory_summary TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';
