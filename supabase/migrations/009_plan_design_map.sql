-- ============================================================
-- ghl_plans: GHL plan catalog (plan_id → package)
-- ============================================================
CREATE TABLE IF NOT EXISTS ghl_plans (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_plan_id  text        NOT NULL UNIQUE,
  name         text        NOT NULL,
  package_slug text        NOT NULL REFERENCES packages (slug) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- plan_design_map: maps a GHL plan to a design + install config
-- ============================================================
CREATE TABLE IF NOT EXISTS plan_design_map (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_plan_id  text        NOT NULL UNIQUE REFERENCES ghl_plans (ghl_plan_id) ON DELETE CASCADE,
  design_slug  text        NOT NULL,
  auto_install boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);
