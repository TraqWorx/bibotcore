-- ============================================================
-- 067: Agency costs table for finance tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS agency_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(10, 2) NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('monthly', 'annual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agency_costs_agency ON agency_costs (agency_id);
ALTER TABLE agency_costs ENABLE ROW LEVEL SECURITY;
