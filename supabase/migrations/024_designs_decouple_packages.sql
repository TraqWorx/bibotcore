-- Decouple designs from packages:
-- 1. Drop the composite unique constraint (package_slug, slug)
-- 2. Add a simple UNIQUE on slug alone
-- 3. Drop the package FK so designs stand alone
-- 4. Make package_slug nullable
-- 5. Add UNIQUE constraint on plan_design_map.ghl_plan_id if missing

ALTER TABLE designs
  DROP CONSTRAINT IF EXISTS designs_package_slug_slug_key,
  DROP CONSTRAINT IF EXISTS designs_package_slug_fkey,
  ALTER COLUMN package_slug DROP NOT NULL;

-- designs_slug_key already exists — no need to recreate it

-- Ensure plan_design_map has unique constraint on ghl_plan_id
ALTER TABLE plan_design_map DROP CONSTRAINT IF EXISTS plan_design_map_ghl_plan_id_key;
ALTER TABLE plan_design_map ADD CONSTRAINT plan_design_map_ghl_plan_id_key UNIQUE (ghl_plan_id);
