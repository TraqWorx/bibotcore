-- ============================================================
-- 118: Free-text notes per Farmacia contact (Tag & Note tab in the
-- customer side panel). Tags already live on farmacia_contacts.tags.
-- ============================================================

ALTER TABLE farmacia_contacts ADD COLUMN IF NOT EXISTS notes TEXT;
