-- ============================================================
-- 090: Tighten the Apulia cache safety-net cron from every 6 hours
-- to every hour. The webhook still handles individual changes in
-- realtime; this catches GHL bulk operations (which don't fire
-- per-contact webhooks) within ~60 minutes instead of ~6 hours.
-- ============================================================

SELECT cron.unschedule('sync-apulia-cache')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-apulia-cache');

SELECT cron.schedule(
  'sync-apulia-cache',
  '23 * * * *',
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
