-- ============================================================
-- 040: Enable RLS on ALL public tables + add policies
-- ============================================================
-- Tables that already have RLS enabled (from earlier migrations):
--   notifications (006), activity_feed (006), automations (007)
-- This migration enables RLS on all remaining tables and adds
-- policies only where the browser/auth client needs access.
-- The service role client bypasses RLS, so tables only accessed
-- server-side via createAdminClient() need no public policies.
-- ============================================================

-- ============================================================
-- 1. Enable RLS on all tables (IF NOT EXISTS not supported,
--    so we use DO blocks to skip tables that already have it)
-- ============================================================

-- Tables that may already have RLS enabled — safe to call again
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS automations ENABLE ROW LEVEL SECURITY;

-- All remaining public tables
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ghl_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS location_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS location_design_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profile_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS design_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ghl_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS plan_design_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS provvigioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gare_mensili ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS design_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ghl_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ghl_private_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS installer_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Policies for profiles
--    Users can read/update their own profile row.
-- ============================================================
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ============================================================
-- 3. Policies for profile_locations
--    Users can read their own location memberships (needed for
--    joins in other policies and client-side queries).
-- ============================================================
CREATE POLICY "Users read own profile_locations"
  ON profile_locations FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- 4. Update activity_feed SELECT policy to use profile_locations
--    (migration 034 introduced the junction table; the old policy
--    from 006 uses profiles.location_id which is the legacy column)
-- ============================================================
DROP POLICY IF EXISTS "Users read own location activity" ON activity_feed;

CREATE POLICY "Users read own location activity"
  ON activity_feed FOR SELECT
  USING (
    location_id IN (
      SELECT pl.location_id
      FROM profile_locations pl
      WHERE pl.user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. ghl_connections — NO public policies.
--    Service role bypasses RLS. No authenticated user should
--    ever read OAuth tokens directly.
-- ============================================================
-- (RLS enabled above, no policies = deny all for non-service-role)

-- ============================================================
-- 6. All other tables — NO public policies.
--    They are only accessed via createAdminClient() (service role)
--    which bypasses RLS. Enabling RLS with no policies means
--    any leaked anon/auth client cannot read them.
--
--    Tables with service-role-only access:
--      packages, installs, usage_metrics, designs, locations,
--      location_settings, location_design_settings, design_configs,
--      ghl_plans, plan_design_map, provvigioni, gare_mensili,
--      user_availability, design_versions, ghl_webhook_events,
--      ghl_private_integrations, automation_executions,
--      installer_jobs
-- ============================================================
