-- Per-location settings (e.g. annual contract target for Apulia Power)
CREATE TABLE IF NOT EXISTS location_settings (
  location_id    text PRIMARY KEY,
  target_annuale int  NOT NULL DEFAULT 1900,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
