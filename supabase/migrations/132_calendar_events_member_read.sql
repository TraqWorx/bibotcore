-- Realtime for cached_calendar_events was dead: the table has RLS enabled with
-- only a service_role policy (112) and was added to the realtime publication
-- (125), but Supabase realtime enforces RLS per subscriber. A browser client
-- subscribing as an authenticated user matched no SELECT policy, so no INSERT/
-- UPDATE/DELETE was ever delivered — the "real-time appointments" pages never
-- refreshed.
--
-- Add a SELECT policy for authenticated users scoped to the locations they can
-- access: a profile_locations member, their profiles.location_id, a super_admin,
-- or a Bibot-agency admin (mirrors canAccessBibotDesign). Server-side reads keep
-- using the service-role key (RLS bypass); this only enables the realtime
-- subscription and location-scoped authenticated reads.

drop policy if exists cached_calendar_events_member_read on public.cached_calendar_events;

create policy cached_calendar_events_member_read
on public.cached_calendar_events
for select
to authenticated
using (
  exists (
    select 1 from public.profile_locations pl
    where pl.user_id = auth.uid()
      and pl.location_id = cached_calendar_events.location_id
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
