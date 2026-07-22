-- ============================================================
-- 133: Repoint every pg_cron HTTP job to the live domain.
--
-- All jobs were scheduled against core.bibotcrm.it, which was
-- decommissioned in June 2026 (live domain: ghlcustomdash.com).
-- Since then every run has hung to its timeout and failed:
--   * Apulia/Farmacia outbound sync, token refresh, plan/location
--     sync, and drip processing were silently dead, and
--   * pg_net + pg_cron logged every failed run, bloating
--     net._http_response / cron.job_run_details — the source of
--     the "Disk IO Budget" depletion warning from Supabase.
--
-- This migration: drops every existing job, reschedules them at
-- ghlcustomdash.com (same schedules, auth headers, timeouts),
-- purges the accumulated failure logs, and adds a weekly cleanup
-- job so cron history can never grow unbounded again.
-- Idempotent: safe to re-run.
-- ============================================================

-- 1. Unschedule everything we own (including the long-replaced dispatch job).
DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN
    SELECT jobid FROM cron.job
    WHERE jobname IN (
      'drip-feed-processor', 'refresh-ghl-tokens', 'sync-ghl-plans',
      'sync-ghl-locations', 'sync-apulia-cache', 'apulia-sync-dispatch',
      'apulia-pdp-dispatch', 'apulia-sync-drain', 'farmacia-sync-drain',
      'cron-history-cleanup'
    )
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

-- 2. Reschedule against the live domain.

SELECT cron.schedule(
  'drip-feed-processor',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ghlcustomdash.com/api/messages/drip-process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1), '')
    ),
    timeout_milliseconds := 30000
  );
  $$
);

SELECT cron.schedule(
  'refresh-ghl-tokens',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ghlcustomdash.com/api/cron/refresh-ghl-tokens',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1), '')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

SELECT cron.schedule(
  'sync-ghl-plans',
  '15 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ghlcustomdash.com/api/cron/sync-ghl-plans',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1), '')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

SELECT cron.schedule(
  'sync-ghl-locations',
  '30 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ghlcustomdash.com/api/cron/sync-ghl-locations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1), '')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

SELECT cron.schedule(
  'sync-apulia-cache',
  '23 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ghlcustomdash.com/api/cron/sync-apulia-cache',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1), '')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

SELECT cron.schedule(
  'apulia-sync-drain',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ghlcustomdash.com/api/apulia/sync/drain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Secret', COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1), '')
    ),
    timeout_milliseconds := 30000
  );
  $$
);

SELECT cron.schedule(
  'apulia-pdp-dispatch',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ghlcustomdash.com/api/apulia/import/pdp/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Secret', COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1), '')
    ),
    timeout_milliseconds := 30000
  );
  $$
);

SELECT cron.schedule(
  'farmacia-sync-drain',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ghlcustomdash.com/api/farmacia/sync/drain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Secret', COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1), '')
    ),
    timeout_milliseconds := 30000
  );
  $$
);

-- 3. Purge a month of failure logs (the Disk IO bloat).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'net' AND c.relname = '_http_response'
  ) THEN
    TRUNCATE net._http_response;
  END IF;
END $$;

DELETE FROM cron.job_run_details WHERE end_time < now() - interval '3 days';

-- 4. Keep cron history bounded from now on (SQL-only job, no HTTP).
SELECT cron.schedule(
  'cron-history-cleanup',
  '10 4 * * 0',
  $$ DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days' $$
);

-- 5. Service-role-readable view so job health can be checked over PostgREST.
CREATE OR REPLACE VIEW public.cron_jobs_debug AS
  SELECT jobname, schedule, active FROM cron.job;
REVOKE ALL ON public.cron_jobs_debug FROM PUBLIC;
REVOKE ALL ON public.cron_jobs_debug FROM anon, authenticated;
GRANT SELECT ON public.cron_jobs_debug TO service_role;
