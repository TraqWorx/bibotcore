-- Apulia list pages decided "the cache is stale" from max(cached_at), which is
-- only ever set when a contact is INSERTED. With no new lead in the last two
-- minutes that test is always true, so visiting Condomini or Amministratori
-- pulled all ~4,500 contacts out of GHL and rewrote every cached row — the
-- hourly reconciliation running on every page view, and the main source of the
-- Disk IO the instance kept running out of.
--
-- One row holding when the reconciliation last finished, and whether one is
-- running right now (so two visitors can't start two of them).

create table if not exists apulia_sync_state (
  id                boolean primary key default true,
  last_full_sync_at timestamptz,
  running_since     timestamptz,
  constraint apulia_sync_state_single_row check (id)
);

alter table apulia_sync_state enable row level security;
-- No policies: service role only, like every other table since migration 135.

insert into apulia_sync_state (id, last_full_sync_at)
values (true, now())
on conflict (id) do nothing;
