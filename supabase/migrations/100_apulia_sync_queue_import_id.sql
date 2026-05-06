-- ============================================================
-- 100: Tag outbound sync ops with their originating import so
-- the Coda sync panel can show per-import drill-down (which
-- rows synced, which failed, with error messages).
--
-- import_id is nullable: ad-hoc ops from UI edits (server
-- actions like updateCondominoField) have no import.
-- ============================================================

ALTER TABLE apulia_sync_queue
  ADD COLUMN IF NOT EXISTS import_id UUID;

CREATE INDEX IF NOT EXISTS apulia_sync_queue_import_id_idx
  ON apulia_sync_queue (import_id)
  WHERE import_id IS NOT NULL;

COMMENT ON COLUMN apulia_sync_queue.import_id IS
  'When this op was created by a bulk import, references apulia_imports.id. Null for ad-hoc ops from UI server actions.';
