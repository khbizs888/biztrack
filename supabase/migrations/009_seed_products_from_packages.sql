-- =============================================================================
-- 009_seed_products_from_packages.sql
--
-- Creates products from existing packages data, then links each package
-- back to its new product via packages.product_id.
--
-- Safe to run multiple times:
--   • Step 1 uses WHERE NOT EXISTS so it skips already-created products
--   • ON CONFLICT (sku) DO NOTHING guards against duplicate SKUs
--   • Step 2 only touches packages where product_id IS NULL
-- =============================================================================


-- ── Step 0: Inspect (runs first, shows you what data exists) ─────────────────

SELECT
  pkg.id,
  proj.name   AS project,
  pkg.name,
  pkg.code,
  pkg.price,
  pkg.is_active,
  pkg.product_id,
  LEFT(pkg.custom_attributes::text, 60) AS attrs_preview
FROM  packages pkg
JOIN  projects proj ON proj.id = pkg.project_id
ORDER BY proj.name, pkg.sort_order, pkg.name
LIMIT 20;


-- ── Step 1: Create one product per unique (project_id, name) ─────────────────
--
-- Selection rules:
--   • Groups by (project_id, name); takes the lowest sort_order row as
--     the representative package for that product.
--   • SKU  = package code when set, otherwise  <PROJ_CODE>-<UPPER_SLUG>
--   • name = package name
--   • selling_price = package price
--   • brand = project name  (FIOR, NE, DD, KHH, Juji)
--   • cost = 0  — no cost data on packages; fill manually in the catalog
--   • status = 'Active'
--
-- Skipped when:
--   • A product with the same (project_id, name) already exists
--   • The generated SKU collides with an existing product (ON CONFLICT guard)

INSERT INTO products (
  project_id,
  sku,
  name,
  cost,
  selling_price,
  brand,
  status,
  created_at,
  updated_at
)
SELECT
  pkg.project_id,

  -- SKU: use package code if set, else build from project code + name slug
  COALESCE(
    NULLIF(TRIM(pkg.code), ''),
    UPPER(proj.code)
      || '-'
      || UPPER(REGEXP_REPLACE(TRIM(pkg.name), '[^a-zA-Z0-9]+', '-', 'g'))
  )                        AS sku,

  pkg.name                 AS name,
  0                        AS cost,           -- fill in unit costs later
  pkg.price                AS selling_price,
  proj.name                AS brand,          -- project name = brand
  'Active'                 AS status,
  now()                    AS created_at,
  now()                    AS updated_at

FROM (
  -- One representative row per (project_id, name);
  -- prefer the package with the lowest sort_order.
  SELECT DISTINCT ON (project_id, name)
    project_id,
    name,
    code,
    price,
    sort_order
  FROM  packages
  WHERE name IS NOT NULL
    AND TRIM(name) <> ''
  ORDER BY project_id, name, sort_order ASC
) pkg

JOIN projects proj ON proj.id = pkg.project_id

-- Skip if a product for this (project, name) already exists
WHERE NOT EXISTS (
  SELECT 1
  FROM   products p
  WHERE  p.project_id = pkg.project_id
    AND  p.name       = pkg.name
)

ON CONFLICT (sku) DO NOTHING;   -- guard against accidental SKU collisions


-- ── Step 2: Back-fill product_id on every unlinked package ───────────────────
--
-- Matches on (project_id, name) — the same key used when inserting above.
-- Only updates packages where product_id is still NULL so existing links
-- are never overwritten.

UPDATE packages pkg
SET    product_id = p.id
FROM   products p
WHERE  pkg.project_id = p.project_id
  AND  pkg.name       = p.name
  AND  pkg.product_id IS NULL;


-- ── Step 3: Verification — review what was created and linked ─────────────────

SELECT
  proj.name                              AS project,
  p.sku,
  p.name                                 AS product,
  p.selling_price,
  COUNT(pkg.id)                          AS packages_linked,
  STRING_AGG(pkg.code, ', ' ORDER BY pkg.sort_order) AS package_codes
FROM   products p
JOIN   projects proj ON proj.id = p.project_id
LEFT   JOIN packages pkg ON pkg.product_id = p.id
GROUP  BY proj.name, p.sku, p.name, p.selling_price
ORDER  BY proj.name, p.name;
