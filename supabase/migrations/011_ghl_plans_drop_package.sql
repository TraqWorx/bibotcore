-- Remove package coupling from ghl_plans
-- Plans now map directly to designs without going through packages
ALTER TABLE ghl_plans
  DROP CONSTRAINT IF EXISTS ghl_plans_package_slug_fkey,
  ALTER COLUMN package_slug DROP NOT NULL;
