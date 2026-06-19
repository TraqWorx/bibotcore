-- ============================================================
-- 116: Store each Farmacia contact's current loyalty tier name so the
-- tier→GHL-tag sync can diff and only enqueue tag changes when the tier
-- actually changes (incl. after the owner edits thresholds).
-- ============================================================

ALTER TABLE farmacia_contacts ADD COLUMN IF NOT EXISTS tier TEXT;
CREATE INDEX IF NOT EXISTS farmacia_contacts_tier_idx ON farmacia_contacts (tier);
