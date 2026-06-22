-- Tenant isolation hardening: give every cached_* and apulia_* table an explicit,
-- reviewed RLS posture instead of "RLS enabled, no policy".
--
-- Reality check: the app reads these tables with the service-role key, which
-- BYPASSES RLS. So tenant isolation for server-side reads is enforced app-side
-- (location_id-scoped queries + getLocationAccess). These policies:
--   * make service_role access explicit and auditable (no silent reliance on bypass),
--   * keep the authenticated/anon paths deny-by-default, EXCEPT the location-scoped
--     portal policies in 051_portal.sql which stay intact (multiple permissive
--     policies are OR-ed, so the service_role policy below does not widen them).
-- Idempotent: safe to re-run.

do $$
declare
  t text;
  tables text[] := array[
    -- shared GHL mirror (location_id-scoped)
    'cached_contacts','cached_opportunities','cached_pipelines','cached_conversations',
    'cached_tasks','cached_notes','cached_custom_fields','cached_contact_custom_fields',
    'cached_messages','cached_invoices','cached_tags','cached_calendars',
    'cached_calendar_events','cached_ghl_users','sync_status',
    -- Apulia bespoke (single-tenant)
    'apulia_contacts','apulia_payments','apulia_imports','apulia_sync_queue',
    'apulia_settings','apulia_stores','apulia_pipelines','apulia_opportunities'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_service', t);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      t || '_service', t
    );
  end loop;
end $$;
