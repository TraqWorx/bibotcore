-- Track subscription lifecycle on locations
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS subscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS churned_at    timestamptz;

-- Backfill: locations that currently have a plan are subscribed
UPDATE locations SET subscribed_at = now() WHERE ghl_plan_id IS NOT NULL AND subscribed_at IS NULL;
