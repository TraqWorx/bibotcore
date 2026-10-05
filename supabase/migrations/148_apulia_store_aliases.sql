-- The PDP import guesses a contact's store by comparing the file's "Note" value
-- against each store's name and city, and asking whether the note CONTAINS the
-- store's name. That is the wrong way round for any store whose name is longer
-- than the note: "STORE SECONDIGLIANO" never matched "Napoli Secondigliano 5",
-- so 252 supplies in the current file had no store. Agent names
-- ("QUARESIMA CARMELA", "MATUOZZO ANNA") matched nothing at all, because no row
-- existed for them — another 718 supplies.
--
-- Matching now compares against an explicit list of spellings, so a new one can
-- be added here rather than in code.

alter table apulia_stores
  add column if not exists aliases text[] not null default '{}';

comment on column apulia_stores.aliases is
  'Spellings of this store or agent as they appear in the client''s export (column "Fornitura : Opportunità : Note"). Compared case-insensitively with whitespace collapsed and a leading "STORE " stripped.';

-- The two agents in the October 2026 file. They are people, not shops: no city,
-- no calendar, so the booking page skips them until one is set.
insert into apulia_stores (slug, name, city, display_order, active, aliases)
values
  ('quaresima-carmela', 'Quaresima Carmela', null, 8, true, array['QUARESIMA CARMELA']),
  ('matuozzo-anna',     'Matuozzo Anna',     null, 9, true, array['MATUOZZO ANNA'])
on conflict (slug) do nothing;

-- Every spelling seen in the client's exports, including the store's own name
-- and city so existing behaviour is preserved.
update apulia_stores set aliases = array['BISCEGLIE', 'STORE BISCEGLIE']            where slug = 'bisceglie';
update apulia_stores set aliases = array['BARLETTA', 'STORE BARLETTA']              where slug = 'barletta';
update apulia_stores set aliases = array['CASAGIOVE', 'STORE CASAGIOVE']            where slug = 'casagiove';
update apulia_stores set aliases = array['CASERTA', 'CASERTA CENTRO', 'STORE CASERTA'] where slug = 'caserta';
update apulia_stores set aliases = array['MESSINA', 'STORE MESSINA']                where slug = 'messina';
update apulia_stores set aliases = array['TORINO', 'STORE TORINO']                  where slug = 'torino';
update apulia_stores set aliases = array['SECONDIGLIANO', 'NAPOLI SECONDIGLIANO', 'STORE SECONDIGLIANO']
  where slug = 'napoli-secondigliano';
