-- Add GHL marketplace fields to packages table
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS ghl_app_id     text,
  ADD COLUMN IF NOT EXISTS ghl_version_id text,
  ADD COLUMN IF NOT EXISTS price_monthly  numeric(10, 2);

-- Unique index for GHL app sync
CREATE UNIQUE INDEX IF NOT EXISTS packages_ghl_app_id_idx ON packages (ghl_app_id)
  WHERE ghl_app_id IS NOT NULL;
