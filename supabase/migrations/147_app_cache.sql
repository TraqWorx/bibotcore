-- A read-through cache for things that are slow because they live in someone
-- else's API. The Finances page spends five seconds walking Stripe's charge
-- list and several more on GHL affiliate calls; Next's unstable_cache does not
-- hold across requests on these force-dynamic routes, so the cache lives here
-- where its behaviour is visible and testable.

create table if not exists app_cache (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_cache enable row level security;
-- No policies: service role only, like every other table since migration 135.
