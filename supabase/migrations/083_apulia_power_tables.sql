-- ============================================================
-- 083: Persistence for the Apulia Power design.
--
-- - apulia_payments: per-admin × period payment ledger (Mark Paid)
-- - apulia_imports:  history log of CSV imports (PDP / switch-out)
-- ============================================================

CREATE TABLE IF NOT EXISTS apulia_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The amministratore is identified by their GHL contact id on Apulia.
  contact_id      TEXT NOT NULL,
  -- Period code, e.g. '2026-H1' / '2026-H2' (semestral payouts).
  period          TEXT NOT NULL,
  amount_cents    BIGINT NOT NULL,
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_by         TEXT,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contact_id, period)
);
CREATE INDEX IF NOT EXISTS apulia_payments_period_idx ON apulia_payments (period);
CREATE INDEX IF NOT EXISTS apulia_payments_contact_idx ON apulia_payments (contact_id);

CREATE TABLE IF NOT EXISTS apulia_imports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            TEXT NOT NULL CHECK (kind IN ('pdp', 'switch_out')),
  filename        TEXT,
  rows_total      INTEGER,
  created         INTEGER DEFAULT 0,
  updated         INTEGER DEFAULT 0,
  tagged          INTEGER DEFAULT 0,
  untagged        INTEGER DEFAULT 0,
  unmatched       INTEGER DEFAULT 0,
  duration_ms     INTEGER,
  status          TEXT NOT NULL DEFAULT 'completed',
  error_msg       TEXT,
  triggered_by    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS apulia_imports_created_idx ON apulia_imports (created_at DESC);

-- Service-role-only access; same pattern as drip_jobs / vat_quarter_status.
ALTER TABLE apulia_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE apulia_imports  ENABLE ROW LEVEL SECURITY;
