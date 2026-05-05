-- ============================================================
-- 026_get_brand_customers.sql
-- RPC function that returns all customers who placed at least
-- one order for a given project within a date range, with:
--   • brand_first_order_date  – their all-time first order for
--     THIS brand (not their global first order ever). Used to
--     determine whether the customer is "new" in the period.
--   • range_spend / range_orders – settled spend and order count
--     within the requested date range (for VIP/dormant checks).
--   • range_last_order_date   – latest order date in the range.
--
-- SECURITY DEFINER so the function runs with the privileges of
-- the definer (postgres/service role) and bypasses RLS.
-- SET statement_timeout prevents long-running queries from
-- being killed by the default 8s timeout.
-- GRANT ensures all Supabase roles can call it.
--
-- The client still paginates with .range() to bypass PostgREST
-- max_rows on the RPC result set.
-- ============================================================

CREATE OR REPLACE FUNCTION get_brand_customers(
  p_project_id       uuid,
  p_date_from        date,
  p_date_to          date
)
RETURNS TABLE (
  id                    uuid,
  name                  text,
  phone                 text,
  customer_tag          text,
  total_orders          bigint,
  total_spent           numeric,
  first_order_date      date,
  last_order_date       date,
  follow_up_date        date,
  follow_up_note        text,
  brand_first_order_date date,
  range_spend           numeric,
  range_orders          bigint,
  range_last_order_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
  SELECT
    c.id,
    c.name,
    c.phone,
    c.customer_tag,
    c.total_orders,
    c.total_spent,
    c.first_order_date,
    c.last_order_date,
    c.follow_up_date,
    c.follow_up_note,
    bfo.brand_first_order_date,
    COALESCE(ro.range_spend,  0)    AS range_spend,
    COALESCE(ro.range_orders, 0)    AS range_orders,
    ro.range_last_order_date
  FROM customers c

  -- must have at least one order in the date range for this project
  INNER JOIN (
    SELECT DISTINCT customer_id
    FROM   orders
    WHERE  project_id   = p_project_id
      AND  order_date  >= p_date_from
      AND  order_date  <= p_date_to
      AND  customer_id IS NOT NULL
  ) range_cids ON range_cids.customer_id = c.id

  -- all-time first order date for this brand (determines "new" status)
  INNER JOIN (
    SELECT customer_id, MIN(order_date) AS brand_first_order_date
    FROM   orders
    WHERE  project_id   = p_project_id
      AND  customer_id IS NOT NULL
    GROUP BY customer_id
  ) bfo ON bfo.customer_id = c.id

  -- within-range aggregates
  LEFT JOIN (
    SELECT
      customer_id,
      SUM(CASE WHEN payment_status = 'Settled' THEN total_price ELSE 0 END) AS range_spend,
      COUNT(*)                                                                AS range_orders,
      MAX(order_date)                                                         AS range_last_order_date
    FROM   orders
    WHERE  project_id   = p_project_id
      AND  order_date  >= p_date_from
      AND  order_date  <= p_date_to
      AND  customer_id IS NOT NULL
    GROUP BY customer_id
  ) ro ON ro.customer_id = c.id

  ORDER BY c.total_spent DESC NULLS LAST
$$;

GRANT EXECUTE ON FUNCTION get_brand_customers(uuid, date, date)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
