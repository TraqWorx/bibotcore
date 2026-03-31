-- ============================================================
-- 050: Role-Based Access Control
-- Adds tenant-level roles to profile_locations junction table.
-- Role hierarchy: location_admin > team_member > viewer
-- Platform-level super_admin (in profiles.role) overrides all.
-- ============================================================

ALTER TABLE profile_locations
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'team_member';

-- Validate role values
ALTER TABLE profile_locations
  ADD CONSTRAINT profile_locations_role_check
  CHECK (role IN ('location_admin', 'team_member', 'viewer'));

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_profile_locations_role
  ON profile_locations (location_id, role);

-- Update existing rows: first user per location becomes location_admin
-- (This is a one-time migration — future users get team_member by default)
WITH first_users AS (
  SELECT DISTINCT ON (location_id) user_id, location_id
  FROM profile_locations
  ORDER BY location_id, created_at ASC
)
UPDATE profile_locations pl
SET role = 'location_admin'
FROM first_users fu
WHERE pl.user_id = fu.user_id AND pl.location_id = fu.location_id;
