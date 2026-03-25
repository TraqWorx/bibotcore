-- ============================================================
-- design_configs: JSON installer config per design slug
-- ============================================================
CREATE TABLE IF NOT EXISTS design_configs (
  design_slug text        PRIMARY KEY,
  config      jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
