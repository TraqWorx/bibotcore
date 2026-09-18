-- Some agencies are run without the subscription paywall (previously hardcoded
-- to the Bibot agency id). Make it a property of the agency instead.
alter table public.agencies add column if not exists billing_exempt boolean not null default false;

-- Finances reads the agency's GHL-connected Stripe account (was a single env var)
alter table public.agencies add column if not exists ghl_stripe_secret_key text;
