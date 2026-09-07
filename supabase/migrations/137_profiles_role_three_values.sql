-- Platform membership is only ever super_admin, admin or agency. What an agency
-- member may DO on a location comes from GHL and lives in profile_locations.role
-- (location_admin = view+edit, team_member = view), never here.
--
-- 'client' and 'user' were the legacy portal-contact values. The portal keys off
-- portal_users + cached_contacts and never reads profiles.role, so nothing needs
-- them. Rows carrying them were migrated to 'agency' on 2026-09-07.

UPDATE public.profiles SET role = 'agency' WHERE role IN ('client', 'user');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'agency'));
