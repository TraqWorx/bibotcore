-- ============================================================
-- 079: SECURITY DEFINER function exposing cron job health to the
-- app's service-role client. Supabase locks down the cron schema
-- by default, so the diagnostics page can't read it directly.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_cron_health()
RETURNS TABLE (
  jobname text,
  schedule text,
  active boolean,
  last_run_at timestamptz,
  last_status text,
  last_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.jobname::text,
    j.schedule::text,
    j.active,
    d.start_time AS last_run_at,
    d.status::text AS last_status,
    LEFT(d.return_message, 200) AS last_message
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT start_time, status, return_message
    FROM cron.job_run_details
    WHERE jobid = j.jobid
    ORDER BY start_time DESC
    LIMIT 1
  ) d ON true
  ORDER BY j.jobname;
END;
$$;

REVOKE ALL ON FUNCTION public.get_cron_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cron_health() TO service_role;
