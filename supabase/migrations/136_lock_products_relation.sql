-- 136 — Lock down `public.products`, still readable by the anon key after 135.
--
-- 135's RLS loop only touches base tables (relkind='r'); `products` survived it,
-- so it is either a view (runs with definer rights, bypassing RLS) or carries an
-- explicit anon grant/policy. It has zero references anywhere in the codebase
-- (no server or client reads/writes), so the safest universal fix — correct for
-- both a table and a view — is to revoke all anon/authenticated access. If it is
-- a base table, also enable RLS with the standard service_role allow.
do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'products' and c.relkind = 'r'
  ) then
    execute 'alter table public.products enable row level security';
    execute 'drop policy if exists srv_all_products on public.products';
    execute 'create policy srv_all_products on public.products for all to service_role using (true) with check (true)';
  end if;
end $$;

revoke all on public.products from anon, authenticated;
