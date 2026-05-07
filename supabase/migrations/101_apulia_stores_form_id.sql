-- ============================================================
-- 101: Bind each store to a GHL form. The lead form URL on the
-- stores page (and the QR code that encodes it) becomes the GHL
-- form's hosted URL — so editing the form in GHL reflects in
-- Bibot/QR immediately, and submissions are tracked by the
-- existing GHL workflow that adds the store-{slug} tag.
-- ============================================================

ALTER TABLE apulia_stores
  ADD COLUMN IF NOT EXISTS form_id TEXT;

COMMENT ON COLUMN apulia_stores.form_id IS
  'GHL form id whose public widget URL is the QR target for this store. NULL means no form assigned yet.';
