-- ============================================================
-- 081: Periodic sync of GHL agency sub-accounts into locations.
-- Runs every 6 hours. Catches new sub-accounts even if the
-- location.created webhook drops, and propagates name renames
-- from GHL into our DB so the diagnostics + admin lists stay
-- accurate without manual touch.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

SELECT cron.unschedule('sync-ghl-locations')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-ghl-locations');

SELECT cron.schedule(
  'sync-ghl-locations',
  '30 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://core.bibotcrm.it/api/cron/sync-ghl-locations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1),
        ''
      )
    ),
    timeout_milliseconds := 60000
  );
  $$
);
