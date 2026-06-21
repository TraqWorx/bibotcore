-- ============================================================
-- 122: Farmacia performance — aggregate tag counts in the DB (instead of
-- loading every contact's tags into JS) + covering indexes for the
-- clusterization and sync-queue drain queries. Mirrors Apulia migration 111.
-- ============================================================

CREATE OR REPLACE FUNCTION farmacia_tag_counts()
RETURNS TABLE(tag text, cnt bigint)
LANGUAGE sql STABLE AS $$
  SELECT t AS tag, count(*) AS cnt
  FROM farmacia_contacts, unnest(tags) AS t
  GROUP BY t
  ORDER BY count(*) DESC;
$$;

CREATE INDEX IF NOT EXISTS farmacia_contacts_order_stats_idx
  ON farmacia_contacts (orders_count, total_spent_cents);

CREATE INDEX IF NOT EXISTS farmacia_sync_queue_drain_idx
  ON farmacia_sync_queue (next_attempt_at, created_at) WHERE status = 'pending';
