-- ============================================================
-- 110: Per-admin payment rule.
--
-- payment_offset_days — days added to a POD's Inizio fornitura before the
--   first commission payment is due (0 = on supply start, 30 = +30 days),
--   then every 6 months. Lives on the admin row; NULL means "use the global
--   default" (apulia_settings key 'payment_offset_days'). Bibot-only.
-- ============================================================

ALTER TABLE public.apulia_contacts
  ADD COLUMN IF NOT EXISTS payment_offset_days INTEGER;
