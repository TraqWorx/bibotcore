-- ============================================================
-- 056: Cached invoices for portal payment history
-- ============================================================

CREATE TABLE IF NOT EXISTS cached_invoices (
  ghl_id           text NOT NULL,
  location_id      text NOT NULL,
  contact_ghl_id   text,
  name             text,
  status           text,
  amount_due       numeric,
  amount_paid      numeric,
  currency         text DEFAULT 'EUR',
  due_date         timestamptz,
  created_at_ghl   timestamptz,
  synced_at        timestamptz NOT NULL DEFAULT now(),
  raw              jsonb,
  PRIMARY KEY (location_id, ghl_id)
);

CREATE INDEX IF NOT EXISTS idx_cached_invoices_contact
  ON cached_invoices (location_id, contact_ghl_id);

ALTER TABLE cached_invoices ENABLE ROW LEVEL SECURITY;

-- Portal users can read their own invoices
CREATE POLICY "Portal users read own invoices"
  ON cached_invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM portal_users pu
      WHERE pu.auth_user_id = auth.uid()
      AND pu.contact_ghl_id = cached_invoices.contact_ghl_id
      AND pu.location_id = cached_invoices.location_id
    )
  );
