-- ============================================================
-- 088: Periodic full-sync of the Apulia contacts cache.
-- Runs every 6 hours as a safety net so that direct edits in the
-- underlying CRM eventually land in our cache even if the realtime
-- webhook misses them.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

SELECT cron.unschedule('sync-apulia-cache')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-apulia-cache');

SELECT cron.schedule(
  'sync-apulia-cache',
  '45 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://core.bibotcrm.it/api/cron/sync-apulia-cache',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1),
        ''
      )
    ),
    timeout_milliseconds := 290000
  );
  $$
);
