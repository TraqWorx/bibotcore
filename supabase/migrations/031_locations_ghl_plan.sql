-- Store GHL plan assignment on locations table (covers all locations, not just connected ones)
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS ghl_plan_id text REFERENCES ghl_plans(ghl_plan_id) ON DELETE SET NULL;
