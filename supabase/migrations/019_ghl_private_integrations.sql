-- Stores GHL agency private integration API key
CREATE TABLE IF NOT EXISTS ghl_private_integrations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key    text NOT NULL,
  label      text NOT NULL DEFAULT 'default',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
