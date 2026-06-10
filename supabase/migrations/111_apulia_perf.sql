-- ============================================================
-- 111: Performance — covering indexes for hot queries + aggregate RPCs
-- that replace app-side pagination loops (count/sum/tag-tally in JS).
-- ============================================================

-- Worker drain: status='pending' AND next_attempt_at <= now ORDER BY created_at.
CREATE INDEX IF NOT EXISTS apulia_sync_queue_drain_idx
  ON public.apulia_sync_queue (next_attempt_at, created_at) WHERE status = 'pending';

-- Payment history / latest-payment by admin: contact_id + paid_at DESC.
CREATE INDEX IF NOT EXISTS apulia_payments_contact_paid_idx
  ON public.apulia_payments (contact_id, paid_at DESC);

-- adminWithPods: PODs of one admin, ordered by pod_pdr.
CREATE INDEX IF NOT EXISTS apulia_contacts_admin_pod_idx
  ON public.apulia_contacts (codice_amministratore, pod_pdr) WHERE is_amministratore = false;

-- Per-store PDP counts + dashboard ranges filter/sort on cached_at.
CREATE INDEX IF NOT EXISTS apulia_contacts_cached_at_idx
  ON public.apulia_contacts (cached_at);

-- Per-POD payment stats (count + last paid) in one query, replacing the
-- "fetch all payments and tally in JS" pagination loops.
CREATE OR REPLACE FUNCTION apulia_pod_payment_stats()
RETURNS TABLE(pod_contact_id text, paid_count bigint, last_paid_at timestamptz)
LANGUAGE sql STABLE AS $$
  SELECT pod_contact_id, count(*) AS paid_count, max(paid_at) AS last_paid_at
  FROM public.apulia_payments
  WHERE pod_contact_id IS NOT NULL
  GROUP BY pod_contact_id;
$$;

-- Total paid (cents) since a date — replaces the "fetch all and sum in JS" loop.
CREATE OR REPLACE FUNCTION apulia_paid_sum_since(from_iso timestamptz)
RETURNS bigint
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(sum(amount_cents), 0)::bigint
  FROM public.apulia_payments
  WHERE paid_at >= from_iso;
$$;

-- Tag usage counts across all contacts — replaces the full-table tag scan.
CREATE OR REPLACE FUNCTION apulia_tag_counts()
RETURNS TABLE(tag text, cnt bigint)
LANGUAGE sql STABLE AS $$
  SELECT t AS tag, count(*) AS cnt
  FROM public.apulia_contacts, unnest(tags) AS t
  GROUP BY t;
$$;
