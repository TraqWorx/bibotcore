-- ============================================================
-- 096: pg_cron driver for the outbound Apulia sync queue.
-- Hits the dispatch endpoint every minute. Dispatch is a 30s
-- ping that kicks /drain (fire-and-forget) when there are
-- pending ops. The drain function processes ops with bounded
-- concurrency and rate-limit-aware backoff.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

SELECT cron.unschedule('apulia-sync-dispatch')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'apulia-sync-dispatch');

SELECT cron.schedule(
  'apulia-sync-dispatch',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://core.bibotcrm.it/api/apulia/sync/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Secret', COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1),
        ''
      )
    ),
    timeout_milliseconds := 25000
  );
  $$
);
