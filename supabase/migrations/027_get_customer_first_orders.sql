-- ============================================================
-- 027_get_customer_first_orders.sql
-- Returns the all-time first order date per customer for a
-- given project.  Used by Customer Insights to determine
-- whether a customer is genuinely "new" within a date range
-- (i.e. their very first ever order for this brand falls
-- inside the range) — independent of any date filter.
--
-- SECURITY DEFINER so it bypasses RLS.
-- ============================================================

CREATE OR REPLACE FUNCTION get_customer_first_orders(
  p_project_id uuid
)
RETURNS TABLE (
  customer_id      uuid,
  first_order_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
  SELECT
    customer_id,
    MIN(order_date)::date AS first_order_date
  FROM orders
  WHERE project_id   = p_project_id
    AND customer_id IS NOT NULL
  GROUP BY customer_id;
$$;

GRANT EXECUTE ON FUNCTION get_customer_first_orders(uuid)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
