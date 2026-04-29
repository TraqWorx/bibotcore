-- ============================================================
-- 080: Schedule daily SaaS plan sync from GHL into ghl_plans.
-- GHL plan prices can change in their UI; without this job our
-- affiliate commission math drifts whenever a plan price moves.
-- Runs every 6 hours — frequent enough to catch mid-day price
-- adjustments, infrequent enough to avoid hammering the API.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

SELECT cron.unschedule('sync-ghl-plans')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-ghl-plans');

SELECT cron.schedule(
  'sync-ghl-plans',
  '15 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://core.bibotcrm.it/api/cron/sync-ghl-plans',
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
