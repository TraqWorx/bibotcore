-- ============================================================
-- 115: Cache of GHL reputation reviews for Farmacia Cialdella.
-- Fetched + cached like cached_invoices (read-only mirror of GHL).
-- RLS service_role only, per 112.
-- ============================================================

CREATE TABLE IF NOT EXISTS farmacia_reviews (
  id            TEXT PRIMARY KEY,            -- GHL review id
  location_id   TEXT NOT NULL,
  rating        NUMERIC,
  title         TEXT,
  body          TEXT,
  reviewer_name TEXT,
  platform      TEXT,                        -- google / facebook / …
  status        TEXT,                        -- e.g. replied / pending
  reply         TEXT,
  review_date   TIMESTAMPTZ,
  raw           JSONB,
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS farmacia_reviews_date_idx     ON farmacia_reviews (review_date DESC);
CREATE INDEX IF NOT EXISTS farmacia_reviews_platform_idx ON farmacia_reviews (platform);

ALTER TABLE farmacia_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farmacia_reviews_service ON farmacia_reviews;
CREATE POLICY farmacia_reviews_service ON farmacia_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);
