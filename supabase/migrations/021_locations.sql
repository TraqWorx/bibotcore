-- Stores GHL location metadata (name synced at OAuth install time)
CREATE TABLE IF NOT EXISTS locations (
  location_id text PRIMARY KEY,
  name        text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_name
ON locations(name);
