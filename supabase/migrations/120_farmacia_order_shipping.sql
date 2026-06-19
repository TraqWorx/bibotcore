-- ============================================================
-- 120: Shipping address on orders (shown in the order detail, Modulo 4).
-- Captured from the Market Rock / ShippyPro file at import.
-- ============================================================

ALTER TABLE farmacia_orders
  ADD COLUMN IF NOT EXISTS ship_name     TEXT,
  ADD COLUMN IF NOT EXISTS ship_address  TEXT,
  ADD COLUMN IF NOT EXISTS ship_city     TEXT,
  ADD COLUMN IF NOT EXISTS ship_zip      TEXT,
  ADD COLUMN IF NOT EXISTS ship_province TEXT,
  ADD COLUMN IF NOT EXISTS ship_country  TEXT;
