-- The importer captures the shipping address per order; keep the latest one on
-- the contact too, so GHL holds a usable address for shipping and segmentation.
alter table public.farmacia_contacts
  add column if not exists address    text,
  add column if not exists city       text,
  add column if not exists postal_code text,
  add column if not exists province   text,
  add column if not exists country    text;
