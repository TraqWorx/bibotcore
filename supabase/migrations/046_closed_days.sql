-- Add closed_days JSONB column to location_settings
ALTER TABLE location_settings
  ADD COLUMN IF NOT EXISTS closed_days jsonb DEFAULT '[]'::jsonb;
