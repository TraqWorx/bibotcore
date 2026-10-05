-- A read-through cache for things that are slow because they live in someone
-- else's API. The Finances page spends five seconds walking Stripe's charge
-- list and several more on GHL affiliate calls. Keeping the cache here rather
-- than in the framework means it survives a deployment, can be inspected, and
-- can be expired by hand.

create table if not exists app_cache (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_cache enable row level security;
-- No policies: service role only, like every other table since migration 135.
