-- Add price_monthly to packages
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS price_monthly numeric(10, 2);
