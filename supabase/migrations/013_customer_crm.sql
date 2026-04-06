-- 013: Customer CRM — adds CRM fields, tag system, and follow-up tracking

-- ============================================================
-- 1. ADD CRM COLUMNS TO customers TABLE
-- ============================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS total_orders        integer        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spent         numeric(10,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_order_date    date,
  ADD COLUMN IF NOT EXISTS last_order_date     date,
  ADD COLUMN IF NOT EXISTS average_order_value numeric(10,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_tag        text           DEFAULT 'New',
  ADD COLUMN IF NOT EXISTS preferred_brand     text,
  ADD COLUMN IF NOT EXISTS preferred_platform  text,
  ADD COLUMN IF NOT EXISTS notes               text,
  ADD COLUMN IF NOT EXISTS last_contacted_at   timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_date      date,
  ADD COLUMN IF NOT EXISTS follow_up_note      text;

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_customers_customer_tag
  ON customers(customer_tag);

CREATE INDEX IF NOT EXISTS idx_customers_last_order_date
  ON customers(last_order_date);

CREATE INDEX IF NOT EXISTS idx_customers_follow_up_date
  ON customers(follow_up_date)
  WHERE follow_up_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_preferred_brand
  ON customers(preferred_brand);

-- ============================================================
-- 3. BACKFILL: compute stats from existing orders
-- ============================================================

WITH order_stats AS (
  SELECT
    o.customer_id,
    COUNT(*)         FILTER (WHERE o.status != 'cancelled')  AS total_orders,
    COALESCE(SUM(o.total_price)  FILTER (WHERE o.status != 'cancelled'), 0) AS total_spent,
    MIN(o.order_date::date)      FILTER (WHERE o.status != 'cancelled')  AS first_order_date,
    MAX(o.order_date::date)      FILTER (WHERE o.status != 'cancelled')  AS last_order_date,
    CASE
      WHEN COUNT(*) FILTER (WHERE o.status != 'cancelled') > 0
      THEN COALESCE(SUM(o.total_price) FILTER (WHERE o.status != 'cancelled'), 0)
           / COUNT(*)            FILTER (WHERE o.status != 'cancelled')
      ELSE 0
    END AS avg_order_value
  FROM orders o
  WHERE o.customer_id IS NOT NULL
  GROUP BY o.customer_id
),
brand_counts AS (
  SELECT
    o.customer_id,
    p.code           AS brand_code,
    COUNT(*)         AS cnt
  FROM orders o
  JOIN projects p ON o.project_id = p.id
  WHERE o.customer_id IS NOT NULL
    AND o.status != 'cancelled'
    AND p.code IS NOT NULL
  GROUP BY o.customer_id, p.code
),
preferred_brands AS (
  SELECT DISTINCT ON (customer_id)
    customer_id,
    brand_code
  FROM brand_counts
  ORDER BY customer_id, cnt DESC
),
platform_counts AS (
  SELECT
    customer_id,
    channel,
    COUNT(*) AS cnt
  FROM orders
  WHERE customer_id IS NOT NULL
    AND status != 'cancelled'
    AND channel IS NOT NULL
  GROUP BY customer_id, channel
),
preferred_platforms AS (
  SELECT DISTINCT ON (customer_id)
    customer_id,
    channel
  FROM platform_counts
  ORDER BY customer_id, cnt DESC
)
UPDATE customers c
SET
  total_orders        = COALESCE(os.total_orders, 0),
  total_spent         = COALESCE(os.total_spent, 0),
  first_order_date    = os.first_order_date,
  last_order_date     = os.last_order_date,
  average_order_value = COALESCE(os.avg_order_value, 0),
  preferred_brand     = pb.brand_code,
  preferred_platform  = pp.channel,
  customer_tag = CASE
    WHEN COALESCE(os.total_orders, 0) >= 5 OR COALESCE(os.total_spent, 0) > 2000
      THEN 'VIP'
    WHEN os.last_order_date IS NOT NULL
      AND os.last_order_date < CURRENT_DATE - INTERVAL '90 days'
      THEN 'Lost'
    WHEN os.last_order_date IS NOT NULL
      AND os.last_order_date < CURRENT_DATE - INTERVAL '30 days'
      THEN 'Dormant'
    WHEN COALESCE(os.total_orders, 0) >= 2
      THEN 'Repeat'
    ELSE 'New'
  END
FROM order_stats os
LEFT JOIN preferred_brands pb  ON os.customer_id = pb.customer_id
LEFT JOIN preferred_platforms pp ON os.customer_id = pp.customer_id
WHERE c.id = os.customer_id;

-- ============================================================
-- 4. PERMISSIONS
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON customers TO authenticated, anon;
GRANT ALL ON customers TO service_role;

NOTIFY pgrst, 'reload schema';
