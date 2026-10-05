-- Every table was locked down in migration 135, but the functions were not.
-- Supabase grants EXECUTE on new functions to anon and authenticated by
-- default, and SECURITY DEFINER functions run past RLS — so the publishable
-- anon key, which ships inside every page this app serves, could call them:
--
--   apulia_admin_pod_counts        returned each administrator's POD counts
--   apulia_lead_counts_per_store   returned per-store lead volumes
--   apulia_debug_cron_secret       reported the cron secret's name and length
--   get_cron_health, apulia_debug_* internal scheduler state
--
-- Verified with a live anon-key call before writing this. Nothing in the app
-- calls an RPC from the browser — every caller is server-side on the service
-- role — so none of these grants were being used.
--
-- The grant to revoke is PUBLIC, not just anon: Postgres grants EXECUTE on a
-- new function to PUBLIC automatically, which is what anon was inheriting.
-- Every function here also carries an explicit service_role grant, so the
-- application keeps its access.

-- Debug leftovers, referenced nowhere in the codebase.
drop function if exists apulia_debug_cron();
drop function if exists apulia_debug_cron_secret();
drop function if exists apulia_debug_cron_runs(integer);
drop function if exists apulia_debug_pg_net(integer);

-- Close the rest. handle_new_user is excluded: it is a trigger function on
-- auth.users, fired by the auth service under its own role, and Postgres
-- refuses to call it directly anyway.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname <> 'handle_new_user'
      -- leave extension-owned functions (pg_trgm's operators) alone
      and not exists (
        select 1 from pg_depend d
        where d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.sig);
  end loop;
end $$;

-- And stop the next migration's function from being granted automatically.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
