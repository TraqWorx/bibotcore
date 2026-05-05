-- ============================================================
-- 091: Track import progress in apulia_imports so a refresh keeps
-- showing the live state. Adds done/total counters and a heartbeat
-- column updated by the route as it streams events. Also widens
-- the kind check to include 'admins' explicitly (was reusing 'pdp'
-- as a workaround).
-- ============================================================

ALTER TABLE apulia_imports
  ADD COLUMN IF NOT EXISTS progress_done    INTEGER,
  ADD COLUMN IF NOT EXISTS progress_total   INTEGER,
  ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS skipped          INTEGER DEFAULT 0;

ALTER TABLE apulia_imports DROP CONSTRAINT IF EXISTS apulia_imports_kind_check;
ALTER TABLE apulia_imports ADD CONSTRAINT apulia_imports_kind_check
  CHECK (kind IN ('pdp', 'switch_out', 'admins'));

ALTER TABLE apulia_imports DROP CONSTRAINT IF EXISTS apulia_imports_status_check;
ALTER TABLE apulia_imports ADD CONSTRAINT apulia_imports_status_check
  CHECK (status IN ('running', 'completed', 'failed'));

CREATE INDEX IF NOT EXISTS apulia_imports_running_idx
  ON apulia_imports (created_at DESC)
  WHERE status = 'running';
