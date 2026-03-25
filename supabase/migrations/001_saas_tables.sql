-- ============================================================
-- SaaS Platform Tables
-- Run this migration in the Supabase SQL editor.
-- ============================================================

-- Extend packages table (may already exist with slug, name, auto_install)
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS auto_apply_design boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Ensure slug is unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'packages_slug_key'
  ) THEN
    ALTER TABLE packages ADD CONSTRAINT packages_slug_key UNIQUE (slug);
  END IF;
END $$;

-- ============================================================
-- installs: one record per (location_id, package_slug) install
-- ============================================================
CREATE TABLE IF NOT EXISTS installs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text        NOT NULL,
  company_id  text,
  package_slug text       NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT now(),
  status      text        NOT NULL DEFAULT 'active',
  UNIQUE (location_id, package_slug)
);

-- ============================================================
-- usage_metrics: lightweight event tracking (no CRM data)
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_metrics (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text        NOT NULL,
  event_type  text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_metrics_location_idx ON usage_metrics (location_id);
CREATE INDEX IF NOT EXISTS usage_metrics_event_idx    ON usage_metrics (event_type);
CREATE INDEX IF NOT EXISTS usage_metrics_created_idx  ON usage_metrics (created_at);
