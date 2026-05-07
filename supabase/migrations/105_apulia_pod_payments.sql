-- ============================================================
-- Per-POD payments
-- ============================================================
-- The owner workflow shifted from "pay the whole admin's commission
-- in 6-month cycles" to "pay individual PODs whenever they're added,
-- each on its own 6-month cycle". apulia_payments now optionally
-- references a single POD via pod_contact_id; rows where it's NULL
-- remain admin-level (kept for legacy and bulk pay-all flows).
--
-- The unique (contact_id, period) constraint from migration 083 is
-- weakened: per-POD rows use auto-generated period strings and the
-- collision check moves to (contact_id, pod_contact_id, period).
-- ============================================================

ALTER TABLE public.apulia_payments
  ADD COLUMN IF NOT EXISTS pod_contact_id TEXT
    REFERENCES public.apulia_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS apulia_payments_pod_idx
  ON public.apulia_payments (pod_contact_id, paid_at DESC)
  WHERE pod_contact_id IS NOT NULL;

-- Drop the legacy unique constraint — per-POD payments need to allow
-- many rows per (admin_contact_id, period) since several PODs can be
-- paid in the same period.
ALTER TABLE public.apulia_payments
  DROP CONSTRAINT IF EXISTS apulia_payments_contact_id_period_key;

-- Replace it with one that still blocks duplicate admin-level entries
-- for the same period (when pod_contact_id IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS apulia_payments_admin_period_unique
  ON public.apulia_payments (contact_id, period)
  WHERE pod_contact_id IS NULL;

-- And one that blocks duplicate per-POD entries on the same period.
CREATE UNIQUE INDEX IF NOT EXISTS apulia_payments_pod_period_unique
  ON public.apulia_payments (pod_contact_id, period)
  WHERE pod_contact_id IS NOT NULL;
