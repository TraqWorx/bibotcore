-- ============================================================
-- 063: Add billing fields to agencies
-- ============================================================

ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS billing_name text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS billing_address_line1 text,
  ADD COLUMN IF NOT EXISTS billing_address_line2 text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_postal_code text,
  ADD COLUMN IF NOT EXISTS billing_country text DEFAULT 'IT',
  ADD COLUMN IF NOT EXISTS billing_vat text,
  ADD COLUMN IF NOT EXISTS billing_sdi text;
