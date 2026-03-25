-- Add price_monthly to designs so MRR can be computed from installs → designs
ALTER TABLE designs
  ADD COLUMN IF NOT EXISTS price_monthly numeric(10, 2);
