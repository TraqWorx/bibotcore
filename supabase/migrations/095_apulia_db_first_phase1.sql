-- ============================================================
-- 095: Phase 1 of the DB-first Apulia refactor.
--
-- apulia_contacts becomes the source of truth; ghl_id is now a
-- separate column. Existing rows keep their GHL contact id as
-- both `id` and `ghl_id` (legacy compat — payments etc. reference
-- it via FK). New rows minted by Bibot get a UUID for `id` and
-- ghl_id IS NULL until the sync worker pushes them to GHL.
--
-- Sync state lives on the row + a separate apulia_sync_queue that
-- the worker drains with rate-limit-aware retries.
-- ============================================================

ALTER TABLE apulia_contacts
  ADD COLUMN IF NOT EXISTS ghl_id              TEXT,
  ADD COLUMN IF NOT EXISTS sync_status         TEXT NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error          TEXT,
  ADD COLUMN IF NOT EXISTS sync_attempts       INT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sync_last_attempt_at TIMESTAMPTZ;

-- Backfill ghl_id for existing rows: today, id IS the GHL id.
UPDATE apulia_contacts SET ghl_id = id WHERE ghl_id IS NULL;

-- Unique index for ghl_id (NULL allowed; many uuids may have null
-- temporarily before the sync worker fills them in).
CREATE UNIQUE INDEX IF NOT EXISTS apulia_contacts_ghl_id_unique
  ON apulia_contacts (ghl_id) WHERE ghl_id IS NOT NULL;

ALTER TABLE apulia_contacts DROP CONSTRAINT IF EXISTS apulia_contacts_sync_status_check;
ALTER TABLE apulia_contacts ADD CONSTRAINT apulia_contacts_sync_status_check
  CHECK (sync_status IN ('synced', 'pending_create', 'pending_update', 'pending_delete', 'failed'));

-- ============================================================
-- Outbound sync queue — operations to push from Bibot → GHL.
-- Each row is processed by a worker; on success, completed_at set
-- and contact's sync_status flipped to 'synced'.
-- ============================================================

CREATE TABLE IF NOT EXISTS apulia_sync_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      TEXT,
  ghl_id          TEXT,
  action          TEXT NOT NULL,
  payload         JSONB,
  status          TEXT NOT NULL DEFAULT 'pending',
  attempts        INT  DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  CONSTRAINT apulia_sync_queue_action_check
    CHECK (action IN ('create', 'update', 'delete', 'add_tag', 'remove_tag', 'set_field')),
  CONSTRAINT apulia_sync_queue_status_check
    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS apulia_sync_queue_pending_idx
  ON apulia_sync_queue (next_attempt_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS apulia_sync_queue_contact_idx
  ON apulia_sync_queue (contact_id)
  WHERE status IN ('pending', 'in_progress');

ALTER TABLE apulia_sync_queue ENABLE ROW LEVEL SECURITY;
