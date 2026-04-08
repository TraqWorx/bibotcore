-- ============================================================
-- 062: Role hierarchy — super_admin / admin / agency / user
--
-- super_admin  → platform owner (info@espressotranslations.com)
-- admin        → agency owners who buy subscription, see all their locations
-- agency       → GHL team members assigned to specific locations
-- user         → contacts / portal users
-- ============================================================

-- 1. Promote agency owners to 'admin'
UPDATE profiles p
SET role = 'admin'
FROM agencies a
WHERE p.id = a.owner_user_id
  AND p.role != 'super_admin';

-- 2. Rename 'client' → 'agency' for users with profile_locations entries (GHL team members)
UPDATE profiles p
SET role = 'agency'
WHERE p.role = 'client'
  AND EXISTS (
    SELECT 1 FROM profile_locations pl WHERE pl.user_id = p.id
  );

-- 3. Rename remaining 'client' → 'user' (portal contacts, unlinked users)
UPDATE profiles
SET role = 'user'
WHERE role = 'client';
