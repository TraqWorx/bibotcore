-- ============================================================
-- 094: pg_cron driver for resumable PDP imports.
-- Hits the dispatch endpoint every minute. The endpoint finds
-- any apulia_imports rows in status='running' with no recent
-- activity and pings their /continue. Backstop in case a
-- self-trigger fetch failed to leave the Vercel function before
-- it terminated.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

SELECT cron.unschedule('apulia-pdp-dispatch')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'apulia-pdp-dispatch');

SELECT cron.schedule(
  'apulia-pdp-dispatch',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://core.bibotcrm.it/api/apulia/import/pdp/dispatch',
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
