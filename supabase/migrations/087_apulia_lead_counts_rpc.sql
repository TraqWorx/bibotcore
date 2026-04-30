-- ============================================================
-- 087: Aggregate lead counts per store. Used by /stores admin
-- view + dashboard. Counts contacts whose tags contain
-- 'store-{slug}' (regardless of 'lead' tag) so that any contact
-- routed through the public lead form is counted.
-- ============================================================

CREATE OR REPLACE FUNCTION public.apulia_lead_counts_per_store(since_iso TIMESTAMPTZ)
RETURNS TABLE (
  slug          TEXT,
  month_count   INTEGER,
  total_count   INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.slug,
    COALESCE(SUM(CASE WHEN c.cached_at >= since_iso THEN 1 ELSE 0 END), 0)::int AS month_count,
    COUNT(c.id)::int                                                            AS total_count
  FROM apulia_stores s
  LEFT JOIN apulia_contacts c
    ON ('store-' || s.slug) = ANY(c.tags)
  GROUP BY s.slug;
$$;

REVOKE ALL ON FUNCTION public.apulia_lead_counts_per_store(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apulia_lead_counts_per_store(TIMESTAMPTZ) TO service_role;
