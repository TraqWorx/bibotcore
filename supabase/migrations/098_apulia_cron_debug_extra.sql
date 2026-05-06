-- Adds extra diagnostics to 097: per-run cron history + pg_net response log.
-- service_role only.

CREATE OR REPLACE FUNCTION public.apulia_debug_cron_runs(n INT DEFAULT 10)
RETURNS TABLE(jobname TEXT, status TEXT, start_time TIMESTAMPTZ, return_message TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT
    j.jobname::TEXT,
    d.status::TEXT,
    d.start_time,
    d.return_message::TEXT
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE j.jobname LIKE 'apulia-sync%'
  ORDER BY d.start_time DESC
  LIMIT n;
$$;
REVOKE ALL ON FUNCTION public.apulia_debug_cron_runs(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apulia_debug_cron_runs(INT) TO service_role;

CREATE OR REPLACE FUNCTION public.apulia_debug_pg_net(n INT DEFAULT 10)
RETURNS TABLE(id BIGINT, status_code INT, content TEXT, created TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, net
AS $$
  SELECT id, status_code, LEFT(COALESCE(content::TEXT, ''), 200), created
  FROM net._http_response
  ORDER BY created DESC
  LIMIT n;
$$;
REVOKE ALL ON FUNCTION public.apulia_debug_pg_net(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apulia_debug_pg_net(INT) TO service_role;
