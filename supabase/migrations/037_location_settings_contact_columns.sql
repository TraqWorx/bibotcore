ALTER TABLE location_settings
  ADD COLUMN IF NOT EXISTS contact_columns jsonb NOT NULL DEFAULT '[]'::jsonb;
