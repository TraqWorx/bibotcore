-- Add unique_fields JSONB column to location_settings
-- Stores array of custom field IDs that must have unique values across contacts
ALTER TABLE location_settings
  ADD COLUMN IF NOT EXISTS unique_fields jsonb DEFAULT '[]'::jsonb;
