-- Design versions table
CREATE TABLE IF NOT EXISTS design_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_slug text NOT NULL REFERENCES designs(slug) ON DELETE CASCADE,
  version     text NOT NULL,
  config      jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (design_slug, version)
);

CREATE INDEX IF NOT EXISTS design_versions_slug_idx ON design_versions (design_slug, version DESC);

-- Add design_version column to installs
ALTER TABLE installs
  ADD COLUMN IF NOT EXISTS design_version text;
