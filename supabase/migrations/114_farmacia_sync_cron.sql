-- ============================================================
-- 114: Drain the Farmacia outbound sync queue every minute.
-- Mirrors 099 (Apulia): pg_cron hits /drain directly. /drain is
-- idempotent (CAS-style claim) and no-ops cheaply when the queue is
-- empty, so running every minute is safe.
-- ============================================================

SELECT cron.schedule(
  'farmacia-sync-drain',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://core.bibotcrm.it/api/farmacia/sync/drain',
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
