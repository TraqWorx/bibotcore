-- Add contact_filters column to location_settings
-- Stores which GHL tags appear as filter chips on the contacts page
-- Example: ["fastweb", "windtre", "energia", "telefonia"]
ALTER TABLE location_settings
  ADD COLUMN IF NOT EXISTS contact_filters jsonb NOT NULL DEFAULT '[]'::jsonb;
