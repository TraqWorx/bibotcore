-- ============================================================
-- 070: Add payment_date to agency_costs
-- ============================================================

ALTER TABLE agency_costs
  ADD COLUMN IF NOT EXISTS payment_date date;
