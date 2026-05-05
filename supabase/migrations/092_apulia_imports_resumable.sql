-- ============================================================
-- 092: Make Apulia imports resumable across Vercel function
-- invocations. Stores the parsed payload + intermediate state in
-- the row so a self-triggering "continue" endpoint can pick up
-- where the previous chunk stopped — keeps each function under the
-- 300s Hobby ceiling.
-- ============================================================

ALTER TABLE apulia_imports
  ADD COLUMN IF NOT EXISTS payload         JSONB,
  ADD COLUMN IF NOT EXISTS payload_meta    JSONB,
  ADD COLUMN IF NOT EXISTS last_continue_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS apulia_imports_continue_idx
  ON apulia_imports (last_continue_at NULLS FIRST)
  WHERE status = 'running';
