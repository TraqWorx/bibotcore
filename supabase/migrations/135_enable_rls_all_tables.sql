-- 135 — Enable RLS on every remaining public table (close rls_disabled_in_public).
--
-- Live-state audit (anon-key probe, 2026-08): the sensitive tables
-- (ghl_connections, profiles, agencies, agency_subscriptions, apulia_*,
-- cached_*, stripe_ghl_charges, ghl_private_integrations, ...) are ALREADY
-- RLS-protected — anon reads return empty. Six tables were still exposed to the
-- public anon key: bellessere_groups, bellessere_schedules, bellessere_services,
-- bellessere_settings, bellessere_users, and the legacy products table. This
-- migration enables RLS on every table that still has it off (idempotent DO
-- block, so it also covers any empty/never-populated tables) and re-asserts the
-- realtime read policies so nothing regresses.
--
-- Safety model:
--   * ALL server code (route handlers, server actions, server components) reads
--     and writes with the service-role key (createAdminClient), and the
--     service_role has BYPASSRLS — so enabling RLS does NOT affect the app's
--     server paths. The explicit service_role policy below is belt-and-braces.
--   * The ONLY browser (authenticated-user) table reads are two tables used for
--     realtime + the activity feed: cached_calendar_events and activity_feed.
--     They get authenticated, location-scoped SELECT policies (mirroring 132).
--   * Authenticated users may read their OWN profile + memberships, so the
--     location-scoped policies (and any auth self-lookups) resolve.
-- After this runs, the anon/public key can no longer read any table.

-- 1) Enable RLS on every currently-unprotected public table + service_role allow.
do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
  loop
    execute format('alter table public.%I enable row level security', t.relname);
    execute format('drop policy if exists %I on public.%I', 'srv_all_' || t.relname, t.relname);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      'srv_all_' || t.relname, t.relname);
  end loop;
end $$;

-- 2) A user may read their own profile row and their own memberships. Needed so
--    the location-scoped policies below (which sub-select these tables) resolve
--    under RLS, and harmless (own data only).
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profile_locations_self_read on public.profile_locations;
create policy profile_locations_self_read on public.profile_locations
  for select to authenticated using (user_id = auth.uid());

-- 3) The only two tables the browser reads (realtime + activity feed). Scope to
--    locations the authenticated user can access (member, own location,
--    super_admin, or Bibot-agency admin). Server reads keep bypassing via
--    service_role.
drop policy if exists cached_calendar_events_member_read on public.cached_calendar_events;
create policy cached_calendar_events_member_read on public.cached_calendar_events
  for select to authenticated
  using (
    exists (
      select 1 from public.profile_locations pl
      where pl.user_id = auth.uid() and pl.location_id = cached_calendar_events.location_id
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'super_admin'
          or p.location_id = cached_calendar_events.location_id
          or (p.role = 'admin' and p.agency_id = 'e7b3d0d8-5682-44d5-87c1-c449e6814f15')
        )
    )
  );

drop policy if exists activity_feed_member_read on public.activity_feed;
create policy activity_feed_member_read on public.activity_feed
  for select to authenticated
  using (
    exists (
      select 1 from public.profile_locations pl
      where pl.user_id = auth.uid() and pl.location_id = activity_feed.location_id
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'super_admin'
          or p.location_id = activity_feed.location_id
          or (p.role = 'admin' and p.agency_id = 'e7b3d0d8-5682-44d5-87c1-c449e6814f15')
        )
    )
  );
