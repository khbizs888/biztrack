-- Migration 020: Search indexes + customer remarks

-- ── Trigram extension for fast ILIKE name search ─────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full-text / partial-match indexes
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON customers USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_phone_btree ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);

-- ── Customer Remarks table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_remarks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  remark      text        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_remarks_customer
  ON customer_remarks(customer_id, created_at DESC);

ALTER TABLE customer_remarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_remarks_authenticated_all"
  ON customer_remarks FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "customer_remarks_service_all"
  ON customer_remarks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT ALL ON customer_remarks TO authenticated;
GRANT ALL ON customer_remarks TO service_role;

-- ── Efficient bulk tag refresh function ──────────────────────────────────────
CREATE OR REPLACE FUNCTION refresh_all_customer_tags()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH customer_stats AS (
    SELECT
      customer_id,
      COUNT(*)           AS orders,
      SUM(total_price)   AS spent,
      MAX(order_date)    AS last_order
    FROM orders
    WHERE status != 'cancelled'
    GROUP BY customer_id
  )
  UPDATE customers
  SET customer_tag = CASE
    WHEN cs.orders = 1                                              THEN 'New'
    WHEN cs.orders >= 6 OR cs.spent > 2000                         THEN 'VIP'
    WHEN cs.last_order < (now() - interval '90 days')::date        THEN 'Lost'
    WHEN cs.last_order < (now() - interval '31 days')::date        THEN 'Dormant'
    ELSE 'Repeat'
  END
  FROM customer_stats cs
  WHERE customers.id = cs.customer_id;

  SELECT COUNT(*) FROM customers;
$$;

GRANT EXECUTE ON FUNCTION refresh_all_customer_tags() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
