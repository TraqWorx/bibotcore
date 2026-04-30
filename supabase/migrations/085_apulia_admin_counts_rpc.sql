-- ============================================================
-- 085: Aggregate POD counts per amministratore code, used by the
-- /amministratori list view to show active vs switched-out POD counts
-- without doing 154 round-trips. Service-role only.
-- ============================================================

CREATE OR REPLACE FUNCTION public.apulia_admin_pod_counts()
RETURNS TABLE (
  codice_amministratore TEXT,
  active                INTEGER,
  switched              INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    codice_amministratore,
    COUNT(*) FILTER (WHERE NOT is_switch_out)::int AS active,
    COUNT(*) FILTER (WHERE is_switch_out)::int     AS switched
  FROM apulia_contacts
  WHERE is_amministratore = false AND codice_amministratore IS NOT NULL
  GROUP BY codice_amministratore;
$$;

REVOKE ALL ON FUNCTION public.apulia_admin_pod_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apulia_admin_pod_counts() TO service_role;
