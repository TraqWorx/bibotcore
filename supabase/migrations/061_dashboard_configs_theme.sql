-- ============================================================
-- 061: Add theme column to dashboard_configs
-- Stores custom colors (primary/secondary) per dashboard
-- ============================================================

ALTER TABLE dashboard_configs
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb;
