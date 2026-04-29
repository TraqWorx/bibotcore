-- ============================================================
-- 076: Schedule proactive GHL token refresh every 6 hours.
-- Endpoint refreshes any connection whose access_token expires
-- within the next 24h, keeping refresh tokens active so GHL
-- never marks them stale.
--
-- The CRON_SECRET is read from supabase_vault (seeded out-of-band,
-- so it does not live in this migration). If the vault entry is
-- missing the cron call will 401 — visible in cron.job_run_details.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- Idempotent: drop any prior schedule of the same name before re-creating.
SELECT cron.unschedule('refresh-ghl-tokens')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-ghl-tokens');

SELECT cron.schedule(
  'refresh-ghl-tokens',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://core.bibotcrm.it/api/cron/refresh-ghl-tokens',
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
