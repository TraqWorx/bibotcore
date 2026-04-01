-- Bulk action job queue for AI-triggered mass operations
CREATE TABLE IF NOT EXISTS bulk_action_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     text NOT NULL,
  created_by      uuid REFERENCES auth.users(id),
  action          text NOT NULL,
  description     text,
  filters         jsonb NOT NULL DEFAULT '{}',
  params          jsonb NOT NULL DEFAULT '{}',
  total_contacts  int NOT NULL DEFAULT 0,
  processed       int NOT NULL DEFAULT 0,
  failed          int NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending',
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_bulk_jobs_status
  ON bulk_action_jobs (status, created_at) WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_location
  ON bulk_action_jobs (location_id, created_at DESC);

ALTER TABLE bulk_action_jobs ENABLE ROW LEVEL SECURITY;
