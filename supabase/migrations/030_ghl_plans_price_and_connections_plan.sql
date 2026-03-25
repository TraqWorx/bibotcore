-- Add price to GHL plans (set manually or fetched from GHL)
ALTER TABLE ghl_plans
  ADD COLUMN IF NOT EXISTS price_monthly numeric(10, 2);

-- Track which GHL plan each connected location is subscribed to
ALTER TABLE ghl_connections
  ADD COLUMN IF NOT EXISTS ghl_plan_id text REFERENCES ghl_plans(ghl_plan_id) ON DELETE SET NULL;
