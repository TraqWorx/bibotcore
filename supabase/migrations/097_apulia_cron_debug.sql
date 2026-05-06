-- ============================================================
-- 097: Diagnostic helper. Exposes cron.job and cron.job_run_details
-- to the service_role so we can debug from scripts without needing
-- direct postgres credentials.
--
-- SECURITY: service_role only. No public/auth/anon grant.
-- ============================================================

CREATE OR REPLACE FUNCTION public.apulia_debug_cron()
RETURNS TABLE(
  jobname TEXT,
  schedule TEXT,
  active BOOLEAN,
  last_status TEXT,
  last_run TIMESTAMPTZ,
  last_message TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT
    j.jobname::TEXT,
    j.schedule::TEXT,
    j.active,
    last.status::TEXT,
    last.start_time,
    last.return_message::TEXT
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT status, start_time, return_message
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid
    ORDER BY start_time DESC
    LIMIT 1
  ) last ON TRUE
  WHERE j.jobname LIKE 'apulia%'
  ORDER BY j.jobname;
$$;

REVOKE ALL ON FUNCTION public.apulia_debug_cron() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apulia_debug_cron() TO service_role;

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

CREATE OR REPLACE FUNCTION public.apulia_debug_cron_secret()
RETURNS TABLE(name TEXT, has_secret BOOLEAN, secret_len INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    'cron_secret'::TEXT,
    EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
    COALESCE((SELECT length(decrypted_secret) FROM vault.decrypted_secrets WHERE name = 'cron_secret'), 0)::INT;
$$;

REVOKE ALL ON FUNCTION public.apulia_debug_cron_secret() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apulia_debug_cron_secret() TO service_role;
