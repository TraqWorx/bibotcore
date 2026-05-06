-- ============================================================
-- 099: Have pg_cron hit /drain directly instead of /dispatch.
--
-- /dispatch tried to fire-and-forget a fetch to /drain inside a
-- short-lived Vercel function. Vercel kills the function on
-- response, terminating the in-flight fetch. Result: the cron
-- said "drained=true" but /drain never actually ran.
--
-- /drain is idempotent (CAS-style claim) and no-ops cheaply when
-- the queue is empty, so we can hit it on every minute regardless.
-- ============================================================

SELECT cron.unschedule('apulia-sync-dispatch')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'apulia-sync-dispatch');

SELECT cron.schedule(
  'apulia-sync-drain',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://core.bibotcrm.it/api/apulia/sync/drain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Secret', COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1),
        ''
      )
    ),
    timeout_milliseconds := 30000
  );
  $$
);
