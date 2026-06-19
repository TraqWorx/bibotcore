-- ============================================================
-- 121: Add Store to per-channel conversions (a store customer who later
-- buys on the site). Return shape changes, so drop + recreate.
-- ============================================================

DROP FUNCTION IF EXISTS farmacia_channel_conversions();

CREATE FUNCTION farmacia_channel_conversions()
RETURNS TABLE(amazon bigint, ebay bigint, store bigint)
LANGUAGE sql STABLE AS $$
  WITH firsts AS (
    SELECT contact_id,
      min(order_date) FILTER (WHERE channel = 'amazon')       AS amazon_first,
      min(order_date) FILTER (WHERE channel = 'ebay')         AS ebay_first,
      min(order_date) FILTER (WHERE channel = 'store')        AS store_first,
      min(order_date) FILTER (WHERE channel = 'online_store') AS online_first
    FROM farmacia_orders
    WHERE contact_id IS NOT NULL
    GROUP BY contact_id
  )
  SELECT
    count(*) FILTER (WHERE amazon_first IS NOT NULL AND online_first IS NOT NULL AND online_first > amazon_first),
    count(*) FILTER (WHERE ebay_first   IS NOT NULL AND online_first IS NOT NULL AND online_first > ebay_first),
    count(*) FILTER (WHERE store_first  IS NOT NULL AND online_first IS NOT NULL AND online_first > store_first)
  FROM firsts;
$$;
