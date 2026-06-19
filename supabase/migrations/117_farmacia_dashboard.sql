-- ============================================================
-- 117: Aggregations for the Farmacia dashboard.
-- - avg_order_cents generated column (scontrino medio) for sorting/leaderboards.
-- - RPCs for period overview, per-channel conversions, and category stats
--   (grouped aggregations the Supabase JS client can't express directly).
-- ============================================================

ALTER TABLE farmacia_contacts
  ADD COLUMN IF NOT EXISTS avg_order_cents BIGINT
  GENERATED ALWAYS AS (CASE WHEN orders_count > 0 THEN total_spent_cents / orders_count ELSE 0 END) STORED;

CREATE INDEX IF NOT EXISTS farmacia_contacts_aov_idx ON farmacia_contacts (avg_order_cents DESC);

-- Period overview: orders, revenue, new vs recurring customers.
CREATE OR REPLACE FUNCTION farmacia_overview(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(orders_count bigint, revenue_cents bigint, new_customers bigint, recurring_customers bigint)
LANGUAGE sql STABLE AS $$
  WITH period_orders AS (
    SELECT * FROM farmacia_orders WHERE order_date >= p_from AND order_date < p_to
  )
  SELECT
    (SELECT count(*) FROM period_orders),
    (SELECT COALESCE(sum(total_cents), 0) FROM period_orders),
    (SELECT count(*) FROM farmacia_contacts WHERE first_order_at >= p_from AND first_order_at < p_to),
    (SELECT count(DISTINCT po.contact_id) FROM period_orders po
       JOIN farmacia_contacts c ON c.id = po.contact_id
       WHERE c.first_order_at < p_from);
$$;

-- Per-channel conversions (lifetime): a marketplace order, then a later online-store order.
CREATE OR REPLACE FUNCTION farmacia_channel_conversions()
RETURNS TABLE(amazon bigint, ebay bigint)
LANGUAGE sql STABLE AS $$
  WITH firsts AS (
    SELECT contact_id,
      min(order_date) FILTER (WHERE channel = 'amazon')       AS amazon_first,
      min(order_date) FILTER (WHERE channel = 'ebay')         AS ebay_first,
      min(order_date) FILTER (WHERE channel = 'online_store') AS online_first
    FROM farmacia_orders
    WHERE contact_id IS NOT NULL
    GROUP BY contact_id
  )
  SELECT
    count(*) FILTER (WHERE amazon_first IS NOT NULL AND online_first IS NOT NULL AND online_first > amazon_first),
    count(*) FILTER (WHERE ebay_first   IS NOT NULL AND online_first IS NOT NULL AND online_first > ebay_first)
  FROM firsts;
$$;

-- Category stats: revenue, distinct orders, repurchase rate, top customer.
CREATE OR REPLACE FUNCTION farmacia_category_stats()
RETURNS TABLE(category text, revenue_cents bigint, orders_count bigint, repurchase_pct numeric, top_customer text)
LANGUAGE sql STABLE AS $$
  WITH item_orders AS (
    SELECT oi.category, o.id AS order_id, o.contact_id, COALESCE(oi.line_total_cents, 0) AS line_total_cents
    FROM farmacia_order_items oi
    JOIN farmacia_orders o ON o.id = oi.order_id
    WHERE oi.category IS NOT NULL AND oi.category <> ''
  ),
  per_cat AS (
    SELECT category, sum(line_total_cents) AS revenue_cents, count(DISTINCT order_id) AS orders_count
    FROM item_orders GROUP BY category
  ),
  cust_cat AS (
    SELECT category, contact_id, count(DISTINCT order_id) AS cust_orders, sum(line_total_cents) AS cust_rev
    FROM item_orders WHERE contact_id IS NOT NULL GROUP BY category, contact_id
  ),
  repurchase AS (
    SELECT category, count(*) AS buyers, count(*) FILTER (WHERE cust_orders >= 2) AS repurchasers
    FROM cust_cat GROUP BY category
  ),
  top_cust AS (
    SELECT DISTINCT ON (cc.category) cc.category,
      COALESCE(NULLIF(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''), c.phone_norm, c.email, '—') AS top_customer
    FROM cust_cat cc JOIN farmacia_contacts c ON c.id = cc.contact_id
    ORDER BY cc.category, cc.cust_rev DESC
  )
  SELECT p.category, p.revenue_cents, p.orders_count,
    CASE WHEN r.buyers > 0 THEN round(100.0 * r.repurchasers / r.buyers, 1) ELSE 0 END,
    t.top_customer
  FROM per_cat p
  LEFT JOIN repurchase r ON r.category = p.category
  LEFT JOIN top_cust  t ON t.category = p.category
  ORDER BY p.revenue_cents DESC;
$$;
