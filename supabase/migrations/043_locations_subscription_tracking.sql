-- Track subscription lifecycle on locations
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS subscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS churned_at    timestamptz;

-- Backfill: use actual account creation date as subscription start
UPDATE locations SET subscribed_at = COALESCE(ghl_date_added, now()) WHERE ghl_plan_id IS NOT NULL AND subscribed_at IS NULL;
