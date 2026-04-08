-- ============================================================
-- 064: Add custom_templates column to dashboard_configs
-- Stores reusable widget templates created via AI
-- ============================================================

ALTER TABLE dashboard_configs
  ADD COLUMN IF NOT EXISTS custom_templates jsonb NOT NULL DEFAULT '[]'::jsonb;
