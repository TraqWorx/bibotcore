-- The Condomini page built its Comune and Amministratore dropdowns by reading
-- up to 2,000 rows for each and de-duplicating in JavaScript — on every page
-- load, two scans whose results were then thrown away, and incomplete besides
-- (there are more than 2,000 condomini, so the lists were missing entries).
--
-- Same scan, but DISTINCT happens here and only the distinct values travel.

create or replace function apulia_condomini_filter_options()
returns table (kind text, value text)
language sql
stable
security definer
set search_path = public
as $$
  select 'comune'::text, comune
  from apulia_contacts
  where is_amministratore = false
    and sync_status <> 'pending_delete'
    and comune is not null
    and comune <> ''
  group by comune
  union all
  select 'amministratore'::text, amministratore_name
  from apulia_contacts
  where is_amministratore = false
    and sync_status <> 'pending_delete'
    and amministratore_name is not null
    and amministratore_name <> ''
  group by amministratore_name
$$;

revoke all on function apulia_condomini_filter_options() from public, anon, authenticated;
