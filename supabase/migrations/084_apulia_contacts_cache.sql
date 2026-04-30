-- ============================================================
-- 084: Local cache of every Apulia Power contact. Reads come from
-- here (instant + filterable + survives GHL outages). The import
-- endpoints + recompute job + a periodic full-sync cron keep it
-- fresh against GHL. Source of truth remains GHL; this is a
-- materialised projection of it.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS apulia_contacts (
  id                       TEXT PRIMARY KEY,
  email                    TEXT,
  phone                    TEXT,
  first_name               TEXT,
  last_name                TEXT,
  tags                     TEXT[] DEFAULT '{}',
  custom_fields            JSONB  DEFAULT '{}'::jsonb,
  -- Hot fields lifted out for indexed filtering.
  pod_pdr                  TEXT,
  codice_amministratore    TEXT,
  amministratore_name      TEXT,
  cliente                  TEXT,
  comune                   TEXT,
  stato                    TEXT,
  compenso_per_pod         NUMERIC,
  pod_override             NUMERIC,
  commissione_totale       NUMERIC,
  is_amministratore        BOOLEAN NOT NULL DEFAULT false,
  is_switch_out            BOOLEAN NOT NULL DEFAULT false,
  ghl_updated_at           TIMESTAMPTZ,
  cached_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS apulia_contacts_pod_pdr_idx       ON apulia_contacts (pod_pdr);
CREATE INDEX IF NOT EXISTS apulia_contacts_codice_idx        ON apulia_contacts (codice_amministratore);
CREATE INDEX IF NOT EXISTS apulia_contacts_admin_idx         ON apulia_contacts (is_amministratore);
CREATE INDEX IF NOT EXISTS apulia_contacts_switch_idx        ON apulia_contacts (is_switch_out);
CREATE INDEX IF NOT EXISTS apulia_contacts_comune_idx        ON apulia_contacts (lower(comune));
CREATE INDEX IF NOT EXISTS apulia_contacts_stato_idx         ON apulia_contacts (lower(stato));
CREATE INDEX IF NOT EXISTS apulia_contacts_cliente_trgm_idx  ON apulia_contacts USING gin (lower(cliente) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS apulia_contacts_admname_trgm_idx  ON apulia_contacts USING gin (lower(amministratore_name) gin_trgm_ops);

ALTER TABLE apulia_contacts ENABLE ROW LEVEL SECURITY;

-- Settings table (key/value) for per-design knobs that the owner can
-- edit at runtime: payment dates, default compenso, etc.
CREATE TABLE IF NOT EXISTS apulia_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

ALTER TABLE apulia_settings ENABLE ROW LEVEL SECURITY;

-- Default payout schedule: 01/01 and 01/07.
INSERT INTO apulia_settings (key, value)
VALUES (
  'payout_schedule',
  '{"H1":"01-01","H2":"07-01"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
