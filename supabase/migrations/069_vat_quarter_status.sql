-- ============================================================
-- 069: VAT quarter status tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS vat_quarter_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  quarter text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial')),
  amount_paid numeric(10, 2) NOT NULL DEFAULT 0,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, quarter)
);

CREATE INDEX IF NOT EXISTS idx_vat_quarter_status_agency ON vat_quarter_status (agency_id);
