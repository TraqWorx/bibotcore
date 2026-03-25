-- Junction table: one user can belong to many locations
CREATE TABLE IF NOT EXISTS profile_locations (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, location_id)
);

-- Seed from existing profiles.location_id
INSERT INTO profile_locations (user_id, location_id)
SELECT id, location_id FROM profiles WHERE location_id IS NOT NULL
ON CONFLICT DO NOTHING;
