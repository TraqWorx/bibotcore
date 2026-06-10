-- ============================================================
-- 109: Store attribution for PODs.
--
-- store — normalized store slug for a condominio, derived from the PDP
--   file's "Fornitura : Opportunità : Note" column at import. NULL when the
--   Note is empty or doesn't match a known store. Bibot-only, not synced
--   to GHL.
--
-- apulia_pdp_counts_per_store_range — per-store PDP counts: range_count is
--   PODs loaded (cached_at) within [from,to), total_count is all-time.
-- ============================================================

ALTER TABLE public.apulia_contacts
  ADD COLUMN IF NOT EXISTS store TEXT;

CREATE INDEX IF NOT EXISTS apulia_contacts_store_idx
  ON public.apulia_contacts (store) WHERE store IS NOT NULL;

CREATE OR REPLACE FUNCTION apulia_pdp_counts_per_store_range(from_iso timestamptz, to_iso timestamptz)
RETURNS TABLE(slug text, range_count bigint, total_count bigint)
LANGUAGE sql STABLE AS $$
  SELECT store AS slug,
         count(*) FILTER (WHERE cached_at >= from_iso AND cached_at < to_iso) AS range_count,
         count(*) AS total_count
  FROM public.apulia_contacts
  WHERE is_amministratore = false
    AND store IS NOT NULL
    AND sync_status <> 'pending_delete'
  GROUP BY store;
$$;
