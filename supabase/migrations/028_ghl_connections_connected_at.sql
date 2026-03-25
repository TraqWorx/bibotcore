-- Add connected_at timestamp to ghl_connections for tracking when each location was connected
ALTER TABLE ghl_connections
  ADD COLUMN IF NOT EXISTS connected_at timestamptz;

-- Backfill from installs.installed_at where available
UPDATE ghl_connections gc
SET connected_at = i.installed_at
FROM installs i
WHERE gc.location_id = i.location_id
  AND gc.connected_at IS NULL
  AND i.installed_at IS NOT NULL;

-- Fallback: use now() for any remaining rows
UPDATE ghl_connections
SET connected_at = now()
WHERE connected_at IS NULL;

-- Enforce NOT NULL and set default for future inserts
ALTER TABLE ghl_connections
  ALTER COLUMN connected_at SET NOT NULL,
  ALTER COLUMN connected_at SET DEFAULT now();
