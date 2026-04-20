-- ============================================================
-- 066: Track refunded amount per subscription
-- ============================================================

ALTER TABLE agency_subscriptions
  ADD COLUMN IF NOT EXISTS refunded_cents integer NOT NULL DEFAULT 0;
