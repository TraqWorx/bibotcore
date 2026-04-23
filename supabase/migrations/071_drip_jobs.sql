-- ============================================================
-- 071: Drip feed message jobs
-- ============================================================

CREATE TABLE IF NOT EXISTS drip_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL,
  type text NOT NULL DEFAULT 'SMS' CHECK (type IN ('SMS', 'WhatsApp')),
  message text NOT NULL,
  image_url text,
  contact_ids jsonb NOT NULL DEFAULT '[]',
  batch_size int NOT NULL DEFAULT 10,
  interval_minutes int NOT NULL DEFAULT 60,
  sent_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  last_batch_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drip_jobs_active ON drip_jobs (status) WHERE status = 'active';
