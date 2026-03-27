-- Maps categories to their associated tags
-- Example: {"Telefonia": ["windtre", "fastweb"], "Energia": ["dolomiti"]}
ALTER TABLE location_settings
  ADD COLUMN IF NOT EXISTS category_tags jsonb NOT NULL DEFAULT '{}'::jsonb;
