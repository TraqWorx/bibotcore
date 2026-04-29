-- ============================================================
-- 082: Cache for charges from the Bibot customer Stripe account
-- (the one behind STRIPE_GHL_SECRET_KEY). The /api/admin/billing
-- and /admin/finances endpoints currently call stripe.charges.list
-- on every render, which doesn't scale and times out as the
-- customer base grows. The new /api/webhooks/stripe-ghl handler
-- writes here on charge events; pages read from this table.
-- ============================================================

CREATE TABLE IF NOT EXISTS stripe_ghl_charges (
  charge_id TEXT PRIMARY KEY,
  customer_id TEXT,
  email TEXT,
  location_id TEXT,
  amount_cents BIGINT NOT NULL,
  fee_cents BIGINT,
  net_cents BIGINT,
  currency TEXT,
  status TEXT NOT NULL,
  receipt_url TEXT,
  refunded_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stripe_ghl_charges_customer_idx ON stripe_ghl_charges (customer_id);
CREATE INDEX IF NOT EXISTS stripe_ghl_charges_location_idx ON stripe_ghl_charges (location_id);
CREATE INDEX IF NOT EXISTS stripe_ghl_charges_email_idx ON stripe_ghl_charges (lower(email));
CREATE INDEX IF NOT EXISTS stripe_ghl_charges_created_idx ON stripe_ghl_charges (created_at DESC);

ALTER TABLE stripe_ghl_charges ENABLE ROW LEVEL SECURITY;
-- Service-role only; no policies = no anon/auth access. Same pattern as the
-- other internal-only tables (drip_jobs, vat_quarter_status).
