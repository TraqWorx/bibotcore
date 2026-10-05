-- The Opportunità page bootstraps its cache inline when the cache is empty —
-- and apulia_opportunities is empty, because this location has no opportunities
-- in GHL. An empty result leaves the cache empty, so the condition stays true
-- and every single page view blocks on a full GHL pipeline + opportunity pull.
--
-- Record when a sync was last ATTEMPTED, not whether it produced rows, so a
-- location with nothing to sync (or a GHL outage) costs one attempt per window
-- instead of one per page view.

alter table apulia_sync_state
  add column if not exists opportunities_synced_at timestamptz;
