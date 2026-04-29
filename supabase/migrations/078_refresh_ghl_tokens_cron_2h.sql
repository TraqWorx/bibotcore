-- ============================================================
-- 078: Tighten the GHL token refresh cadence from every 6h to
-- every 2h. GHL location access tokens have a 24h life; refreshing
-- every 2h means each token rotates ~12 times per day, so even if
-- one refresh fails transiently the next attempt arrives long
-- before expiry. Refresh tokens stay perpetually warm.
-- ============================================================

SELECT cron.unschedule('refresh-ghl-tokens')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-ghl-tokens');

SELECT cron.schedule(
  'refresh-ghl-tokens',
  '0 */2 * * *',
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
