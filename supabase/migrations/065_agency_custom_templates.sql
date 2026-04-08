-- ============================================================
-- 065: Move custom_templates from dashboard_configs to agencies
-- Shared across all locations for the agency
-- ============================================================

ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS custom_templates jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Drop from dashboard_configs (no longer needed there)
ALTER TABLE dashboard_configs
  DROP COLUMN IF EXISTS custom_templates;
