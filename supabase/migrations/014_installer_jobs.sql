-- Installer jobs queue
CREATE TABLE IF NOT EXISTS installer_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   text NOT NULL,
  design_slug   text NOT NULL,
  design_version text,
  status        text NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'done' | 'failed'
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  completed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS installer_jobs_status_idx ON installer_jobs (status, created_at);
