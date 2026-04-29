-- ============================================================
-- 077: Migrate drip-feed cron from broken _cron_config lookup
-- to the same supabase_vault pattern used by 076. The original
-- 072 schedule referenced public._cron_config which never landed
-- on the remote DB, so the drip cron has been a silent no-op.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- Drop the old (broken) schedule if it exists.
SELECT cron.unschedule('drip-feed-processor')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drip-feed-processor');

-- Re-schedule with hardcoded URL + vault-backed secret. Header
-- auth keeps the secret out of net.http_post URL access logs.
SELECT cron.schedule(
  'drip-feed-processor',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://core.bibotcrm.it/api/messages/drip-process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1),
        ''
      )
    ),
    timeout_milliseconds := 30000
  );
  $$
);
