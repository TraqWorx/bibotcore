-- ============================================================
-- 068: VAT payments tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS vat_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL,
  period text NOT NULL,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vat_payments_agency ON vat_payments (agency_id);
ALTER TABLE vat_payments ENABLE ROW LEVEL SECURITY;
