-- ============================================================
-- 119: Import metadata for the channel-box imports (Modulo 3).
-- origin = which box (amazon/ebay/store/sito); file_url = stored upload for
-- download; discarded = rows rejected by validation (reasons in summary).
-- ============================================================

ALTER TABLE farmacia_imports
  ADD COLUMN IF NOT EXISTS origin    TEXT,
  ADD COLUMN IF NOT EXISTS file_url  TEXT,
  ADD COLUMN IF NOT EXISTS discarded INTEGER DEFAULT 0;
