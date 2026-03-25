-- Drop FK constraint on locations.ghl_plan_id — plan IDs come directly from GHL
-- and don't always match our local ghl_plans cache. Store as plain text.
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_ghl_plan_id_fkey;
