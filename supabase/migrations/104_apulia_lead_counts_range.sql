-- ============================================================
-- 104: Range-based lead counts. The previous RPC took only a
-- "since" cutoff and a derived total; this one takes a window
-- (from, to) and returns the count within that window plus the
-- all-time total. Used by the stores page date-range picker.
-- ============================================================

CREATE OR REPLACE FUNCTION public.apulia_lead_counts_per_store_range(
  from_iso TIMESTAMPTZ,
  to_iso   TIMESTAMPTZ
)
RETURNS TABLE (
  slug          TEXT,
  range_count   INTEGER,
  total_count   INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.slug,
    COALESCE(SUM(
      CASE WHEN c.cached_at >= from_iso AND (to_iso IS NULL OR c.cached_at < to_iso) THEN 1 ELSE 0 END
    ), 0)::int AS range_count,
    COUNT(c.id)::int AS total_count
  FROM apulia_stores s
  LEFT JOIN apulia_contacts c
    ON ('store-' || s.slug) = ANY(c.tags)
    OR s.slug              = ANY(c.tags)
  GROUP BY s.slug;
$$;

REVOKE ALL ON FUNCTION public.apulia_lead_counts_per_store_range(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apulia_lead_counts_per_store_range(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
