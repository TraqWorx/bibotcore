-- ghl_webhook_events is a raw log: every inbound GHL event, never read back
-- (the caches hold the state). It had grown to 724MB / 252k rows, and the
-- write-and-vacuum churn is a large part of this project's Disk IO budget.
-- Keep 30 days, delete in batches so a small instance isn't stalled.

create or replace function prune_ghl_webhook_events(
  retention_days int default 30,
  batch_size int default 5000,
  max_batches int default 100
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - make_interval(days => retention_days);
  removed bigint := 0;
  batch bigint;
begin
  for i in 1..max_batches loop
    with doomed as (
      select id from ghl_webhook_events where received_at < cutoff limit batch_size
    ), del as (
      delete from ghl_webhook_events e using doomed d where e.id = d.id returning 1
    )
    select count(*)::bigint into batch from del;
    removed := removed + batch;
    exit when batch = 0;
  end loop;
  return removed;
end;
$$;

revoke all on function prune_ghl_webhook_events(int, int, int) from public, anon, authenticated;

select cron.schedule('ghl-webhook-event-retention', '20 4 * * *', $$select prune_ghl_webhook_events(30)$$)
where not exists (select 1 from cron.job where jobname = 'ghl-webhook-event-retention');
