-- ============================================================
-- designs: available visual themes per package
-- ============================================================
CREATE TABLE IF NOT EXISTS designs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  package_slug text        NOT NULL REFERENCES packages (slug) ON DELETE CASCADE,
  slug         text        NOT NULL,
  name         text        NOT NULL,
  is_default   boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_slug, slug)
);

-- Seed designs (gym-modern is the default)
INSERT INTO designs (package_slug, slug, name, is_default)
VALUES
  ('gym', 'gym-modern',  'Modern Gym', true),
  ('gym', 'gym-dark',    'Dark Gym',   false),
  ('gym', 'gym-minimal', 'Minimal Gym', false)
ON CONFLICT (package_slug, slug) DO NOTHING;

-- installs: add design_slug column
ALTER TABLE installs
  ADD COLUMN IF NOT EXISTS design_slug text;
