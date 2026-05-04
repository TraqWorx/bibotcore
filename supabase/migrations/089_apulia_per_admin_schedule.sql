-- ============================================================
-- 089: Per-amministratore payment schedule.
--
-- Each admin gets their own anchor date (first_payment_at) — the
-- day their first matching POD was imported. Subsequent payments
-- fall due every 6 months from that anchor (period 1 = day 0,
-- period 2 = +6mo, period 3 = +12mo, …). The owner can edit
-- the anchor manually from /settings.
--
-- apulia_payments period semantics shift from a global string
-- like '2026-H1' to a per-admin period_idx (1, 2, 3, …) plus
-- the actual due date for audit. The legacy `period` column is
-- preserved for any historical rows but new rows use period_idx.
-- ============================================================

ALTER TABLE apulia_contacts
  ADD COLUMN IF NOT EXISTS first_payment_at TIMESTAMPTZ;

ALTER TABLE apulia_payments
  ADD COLUMN IF NOT EXISTS period_idx INTEGER,
  ADD COLUMN IF NOT EXISTS period_due_date DATE;

-- New unique constraint scoped to per-admin period number. Old
-- (contact_id, period) constraint stays for legacy rows.
CREATE UNIQUE INDEX IF NOT EXISTS apulia_payments_contact_period_idx_unique
  ON apulia_payments (contact_id, period_idx)
  WHERE period_idx IS NOT NULL;

-- RPC that returns each admin's anchor + next due date + how
-- many periods are unpaid as of today. Used by /amministratori
-- and /settings.
CREATE OR REPLACE FUNCTION public.apulia_admin_schedule()
RETURNS TABLE (
  contact_id        TEXT,
  first_payment_at  TIMESTAMPTZ,
  paid_count        INTEGER,
  next_period_idx   INTEGER,
  next_due_date     DATE,
  is_due_now        BOOLEAN,
  overdue_count     INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH paid AS (
    SELECT a.id AS contact_id,
           COALESCE(MAX(p.period_idx), 0) AS paid_count
    FROM apulia_contacts a
    LEFT JOIN apulia_payments p
      ON p.contact_id = a.id AND p.period_idx IS NOT NULL
    WHERE a.is_amministratore = true
    GROUP BY a.id
  )
  SELECT
    a.id,
    a.first_payment_at,
    paid.paid_count,
    paid.paid_count + 1                                                        AS next_period_idx,
    CASE
      WHEN a.first_payment_at IS NULL THEN NULL
      ELSE (a.first_payment_at + INTERVAL '6 months' * paid.paid_count)::date
    END                                                                        AS next_due_date,
    CASE
      WHEN a.first_payment_at IS NULL THEN false
      ELSE (a.first_payment_at + INTERVAL '6 months' * paid.paid_count) <= NOW()
    END                                                                        AS is_due_now,
    CASE
      WHEN a.first_payment_at IS NULL THEN 0
      ELSE GREATEST(
        0,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - a.first_payment_at)) / EXTRACT(EPOCH FROM INTERVAL '6 months'))::int + 1 - paid.paid_count
      )
    END                                                                        AS overdue_count
  FROM apulia_contacts a
  JOIN paid ON paid.contact_id = a.id
  WHERE a.is_amministratore = true;
$$;

REVOKE ALL ON FUNCTION public.apulia_admin_schedule() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apulia_admin_schedule() TO service_role;
