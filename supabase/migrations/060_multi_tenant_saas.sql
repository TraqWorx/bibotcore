-- ============================================================
-- 060: Multi-tenant SaaS foundation
-- Adds agencies, per-location subscriptions, dashboard configs
-- ============================================================

-- ── Agencies ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  stripe_customer_id text UNIQUE,
  ghl_company_id text,
  ghl_agency_token text,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agencies_owner ON agencies (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_agencies_stripe ON agencies (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

-- Owner can read their own agency
CREATE POLICY "agency_owner_select" ON agencies
  FOR SELECT USING (owner_user_id = auth.uid());

-- Service role can do anything (admin/platform operations)
-- No INSERT/UPDATE/DELETE policies for regular users — all mutations go through service role

-- ── Agency Subscriptions (per sub-account) ──────────────────
CREATE TABLE IF NOT EXISTS agency_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  location_id text NOT NULL,
  plan text NOT NULL CHECK (plan IN ('basic', 'pro')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  price_cents integer NOT NULL DEFAULT 1000,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_subs_agency ON agency_subscriptions (agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_subs_location ON agency_subscriptions (location_id);
CREATE INDEX IF NOT EXISTS idx_agency_subs_status ON agency_subscriptions (status);

ALTER TABLE agency_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read subscriptions for their agency
CREATE POLICY "agency_sub_select" ON agency_subscriptions
  FOR SELECT USING (
    agency_id IN (SELECT id FROM agencies WHERE owner_user_id = auth.uid())
  );

-- ── Dashboard Configs (per-location widget layout) ──────────
CREATE TABLE IF NOT EXISTS dashboard_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL UNIQUE,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  config jsonb NOT NULL DEFAULT '[]'::jsonb,
  embed_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_configs_token ON dashboard_configs (embed_token);
CREATE INDEX IF NOT EXISTS idx_dashboard_configs_agency ON dashboard_configs (agency_id);

ALTER TABLE dashboard_configs ENABLE ROW LEVEL SECURITY;

-- Users can read configs for their agency
CREATE POLICY "dashboard_config_select" ON dashboard_configs
  FOR SELECT USING (
    agency_id IN (SELECT id FROM agencies WHERE owner_user_id = auth.uid())
  );

-- ── Add agency_id to existing tables ────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_agency ON profiles (agency_id) WHERE agency_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_locations_agency ON locations (agency_id) WHERE agency_id IS NOT NULL;

-- ── Seed Bibot as the first agency ──────────────────────────
-- This uses a DO block so it's idempotent
DO $$
DECLARE
  bibot_agency_id uuid;
  bibot_owner_id uuid;
BEGIN
  -- Find the super_admin user to set as owner
  SELECT id INTO bibot_owner_id FROM profiles WHERE role = 'super_admin' LIMIT 1;

  -- Create Bibot agency if it doesn't exist
  INSERT INTO agencies (name, email, owner_user_id)
  VALUES ('Bibot', COALESCE((SELECT email FROM auth.users WHERE id = bibot_owner_id), 'admin@bibotcrm.it'), bibot_owner_id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO bibot_agency_id;

  -- If it already existed, fetch the id
  IF bibot_agency_id IS NULL THEN
    SELECT id INTO bibot_agency_id FROM agencies WHERE name = 'Bibot' LIMIT 1;
  END IF;

  -- Link all existing locations to Bibot
  IF bibot_agency_id IS NOT NULL THEN
    UPDATE locations SET agency_id = bibot_agency_id WHERE agency_id IS NULL;
    UPDATE profiles SET agency_id = bibot_agency_id WHERE agency_id IS NULL AND role != 'super_admin';
  END IF;
END $$;
