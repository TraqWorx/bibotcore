-- ============================================================
-- 052: AI Module — usage tracking and rate limiting
-- ============================================================

-- Per-request usage log
CREATE TABLE IF NOT EXISTS ai_usage (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  text NOT NULL,
  user_id      uuid REFERENCES auth.users(id),
  action       text NOT NULL,
  tokens_in    int NOT NULL DEFAULT 0,
  tokens_out   int NOT NULL DEFAULT 0,
  model        text NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_location
  ON ai_usage (location_id, created_at DESC);

-- Per-location monthly rate limits
CREATE TABLE IF NOT EXISTS ai_rate_limits (
  location_id      text PRIMARY KEY,
  monthly_limit    int NOT NULL DEFAULT 100000,
  current_month    text NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  tokens_used      int NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS (service-role-only)
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomic token increment function for rate limiting
CREATE OR REPLACE FUNCTION increment_ai_tokens(p_location_id text, p_tokens int)
RETURNS void LANGUAGE sql AS $$
  UPDATE ai_rate_limits
  SET tokens_used = tokens_used + p_tokens, updated_at = now()
  WHERE location_id = p_location_id;
$$;
