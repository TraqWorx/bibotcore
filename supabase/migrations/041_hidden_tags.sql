ALTER TABLE location_settings ADD COLUMN IF NOT EXISTS hidden_tags jsonb NOT NULL DEFAULT '[]'::jsonb;
