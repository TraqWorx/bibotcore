-- ============================================================
-- 108: Real switch-out date.
--
-- switched_out_at — the actual date a POD left the contract, taken from
--   the "Data esecuzione attività" column of the client's switch-out
--   export. NULL for active PODs and for legacy switch-outs imported
--   before this column existed (UI falls back to cached_at for those).
--
-- Bibot-only: not synced to GHL. Commission already stops the moment
-- is_switch_out flips true (switched-out PODs are excluded from every
-- due/commission calc); this column records WHEN it happened, so the
-- switch-out views show the true date instead of the upload date.
-- ============================================================

ALTER TABLE public.apulia_contacts
  ADD COLUMN IF NOT EXISTS switched_out_at TIMESTAMPTZ;
