-- ============================================================
-- 086: Physical stores (Store Fisici) for Apulia Power lead capture
-- and per-store booking pages. Each store has:
-- - a public QR-form URL (/apulia/lead/{slug}) for QR codes printed
--   on flyers/POP materials
-- - a GHL calendar id + widget slug for the booking widget
-- - tags applied to leads coming from this store: ['lead',
--   'store-{slug}'] which existing GHL Lead Intake workflows fire on
-- ============================================================

CREATE TABLE IF NOT EXISTS apulia_stores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  city                  TEXT,
  address               TEXT,
  calendar_id           TEXT,
  calendar_widget_slug  TEXT,
  pipeline_id           TEXT,
  display_order         INTEGER NOT NULL DEFAULT 0,
  active                BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS apulia_stores_slug_idx          ON apulia_stores (slug);
CREATE INDEX IF NOT EXISTS apulia_stores_active_idx        ON apulia_stores (active, display_order);

ALTER TABLE apulia_stores ENABLE ROW LEVEL SECURITY;
-- Service-role only.

INSERT INTO apulia_stores (slug, name, city, calendar_id, calendar_widget_slug, display_order)
VALUES
  ('bisceglie', 'Bisceglie 1', 'Bisceglie', '3vsIGoBhprfdcWiUXK8C', 'admin-1-contract-signing', 1),
  ('barletta', 'Barletta 2', 'Barletta', 'BgSJ3bZ4VOBma62b0TR1', 'admin-1-contract-signingpqykcx', 2),
  ('casagiove', 'Casagiove 3', 'Casagiove', 'lSnsnFrIvSgoIzct5IuQ', 'admin-1-contract-signingpqykcxwbffjt', 3),
  ('caserta', 'Caserta Centro 4', 'Caserta', 'xdeicGi8dsc7BmjW1kob', 'admin-1-contract-signingpqykcxwbffjtuis86c', 4),
  ('napoli-secondigliano', 'Napoli Secondigliano 5', 'Napoli', 'VPHNjjrse74SzZQXdjFK', 'admin-1-contract-signingpqykcxwbffjtuis86c35jiab', 5),
  ('torino', 'Torino 6', 'Torino', 'xnnElimna38pybc9nq59', 'admin-1-contract-signingpqykcxwbffjtuis86csehasm', 6),
  ('messina', 'Messina 7', 'Messina', 'rrLXWiuOFksH24zmRKuj', 'admin-1-contract-signingpqykcxwbffjtuis86csehasm4dsj0e', 7)
ON CONFLICT (slug) DO NOTHING;
