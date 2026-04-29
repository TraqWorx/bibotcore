-- ============================================================
-- 075: Track when each GHL connection was last refreshed.
-- Used by /admin/diagnostics and the auto-refresh cron.
-- ============================================================

ALTER TABLE ghl_connections
  ADD COLUMN IF NOT EXISTS refreshed_at TIMESTAMPTZ;

-- Index used by the cron job to pick up tokens nearing expiry first.
CREATE INDEX IF NOT EXISTS ghl_connections_expires_at_idx
  ON ghl_connections (expires_at);
