-- ============================================================
-- 102: Rich per-import summary so the imports page can show
-- everything the user wants: which rows were skipped and why,
-- how many admins were auto-created during a PDP import,
-- recompute totals, etc.
-- ============================================================

ALTER TABLE apulia_imports
  ADD COLUMN IF NOT EXISTS summary JSONB;

COMMENT ON COLUMN apulia_imports.summary IS
  'Kind-specific extras: admin auto-creates, recompute totals, skipped-reason breakdown. UI renders this on click of an import row.';
