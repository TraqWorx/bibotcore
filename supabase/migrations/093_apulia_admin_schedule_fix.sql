-- ============================================================
-- 093: Fix the per-admin schedule formula. Original logic placed
-- period 1 ON the anchor date (day 0), so admins lit up as
-- "Da pagare oggi" the moment first_payment_at was set. The
-- intent is that first_payment_at is the *cycle anchor* (the day
-- the first POD imported under that admin), and the first payment
-- becomes due 6 months later.
--
--   next_due_date  = first_payment_at + 6mo * (paid_count + 1)
--   overdue_count  = floor((now - anchor) / 6mo) - paid_count, clamped >= 0
-- ============================================================

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
    paid.paid_count + 1                                                              AS next_period_idx,
    CASE
      WHEN a.first_payment_at IS NULL THEN NULL
      ELSE (a.first_payment_at + INTERVAL '6 months' * (paid.paid_count + 1))::date
    END                                                                              AS next_due_date,
    CASE
      WHEN a.first_payment_at IS NULL THEN false
      ELSE (a.first_payment_at + INTERVAL '6 months' * (paid.paid_count + 1)) <= NOW()
    END                                                                              AS is_due_now,
    CASE
      WHEN a.first_payment_at IS NULL THEN 0
      ELSE GREATEST(
        0,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - a.first_payment_at)) / EXTRACT(EPOCH FROM INTERVAL '6 months'))::int - paid.paid_count
      )
    END                                                                              AS overdue_count
  FROM apulia_contacts a
  JOIN paid ON paid.contact_id = a.id
  WHERE a.is_amministratore = true;
$$;

REVOKE ALL ON FUNCTION public.apulia_admin_schedule() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apulia_admin_schedule() TO service_role;
