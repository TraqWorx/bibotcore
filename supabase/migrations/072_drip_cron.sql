-- ============================================================
-- 072: Schedule drip feed processor via pg_cron + pg_net
-- Runs every 5 minutes, calls the drip-process API endpoint
-- ============================================================

-- Enable required extensions (Supabase has these available)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Config table for cron secrets (not exposed via API)
CREATE TABLE IF NOT EXISTS _cron_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- Insert the secret (update this value if you rotate the CRON_SECRET)
INSERT INTO _cron_config (key, value)
VALUES ('drip_process_url', 'https://core.bibotcrm.it/api/messages/drip-process?secret=REPLACE_WITH_CRON_SECRET')
ON CONFLICT (key) DO NOTHING;

-- Schedule: every 5 minutes, fetch URL from config
SELECT cron.schedule(
  'drip-feed-processor',
  '*/5 * * * *',
  $$
  SELECT net.http_get(
    url := (SELECT value FROM _cron_config WHERE key = 'drip_process_url'),
    timeout_milliseconds := 30000
  );
  $$
);
