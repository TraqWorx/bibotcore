-- The cache sync deleted every custom-field row for every synced contact and
-- re-inserted it, four times a day: ~18M inserts and ~18M deletes over the
-- project's life, and a large share of its Disk IO budget. This does the same
-- work as one statement that only writes rows whose value actually changed,
-- then removes the fields GHL no longer returns.

create or replace function sync_contact_custom_fields(
  p_location_id text,
  p_contact_ghl_id text,
  p_fields jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into cached_contact_custom_fields (location_id, contact_ghl_id, field_id, field_key, value)
  select p_location_id, p_contact_ghl_id, f->>'field_id', f->>'field_key', f->>'value'
  from jsonb_array_elements(coalesce(p_fields, '[]'::jsonb)) f
  where f->>'field_id' is not null
  on conflict (location_id, contact_ghl_id, field_id) do update
    set value = excluded.value, field_key = excluded.field_key
    where cached_contact_custom_fields.value is distinct from excluded.value
       or cached_contact_custom_fields.field_key is distinct from excluded.field_key;

  delete from cached_contact_custom_fields c
  where c.location_id = p_location_id
    and c.contact_ghl_id = p_contact_ghl_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_fields, '[]'::jsonb)) f
      where f->>'field_id' = c.field_id
    );
end;
$$;

/** Batch form: p_rows is [{location_id, contact_ghl_id, field_id, value}, …]. */
create or replace function sync_contact_custom_fields_batch(p_location_id text, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  create temp table _incoming on commit drop as
  select r->>'contact_ghl_id' as contact_ghl_id, r->>'field_id' as field_id,
         r->>'field_key' as field_key, r->>'value' as value
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  where r->>'contact_ghl_id' is not null and r->>'field_id' is not null;

  insert into cached_contact_custom_fields (location_id, contact_ghl_id, field_id, field_key, value)
  select p_location_id, contact_ghl_id, field_id, field_key, value from _incoming
  on conflict (location_id, contact_ghl_id, field_id) do update
    set value = excluded.value, field_key = excluded.field_key
    where cached_contact_custom_fields.value is distinct from excluded.value
       or cached_contact_custom_fields.field_key is distinct from excluded.field_key;

  -- only for the contacts in this batch: drop fields GHL no longer sends
  delete from cached_contact_custom_fields c
  using (select distinct contact_ghl_id from _incoming) touched
  where c.location_id = p_location_id
    and c.contact_ghl_id = touched.contact_ghl_id
    and not exists (
      select 1 from _incoming i
      where i.contact_ghl_id = c.contact_ghl_id and i.field_id = c.field_id
    );
end;
$$;

revoke all on function sync_contact_custom_fields(text, text, jsonb) from public, anon, authenticated;
revoke all on function sync_contact_custom_fields_batch(text, jsonb) from public, anon, authenticated;
