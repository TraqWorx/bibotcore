-- Bellessere DB-first: replicate GHL data locally so pages never depend on GHL being up

create table if not exists bellessere_users (
  id           text primary key,              -- GHL user ID
  location_id  text not null,
  name         text,
  email        text,
  phone        text,
  synced_at    timestamptz default now()
);
create index if not exists idx_bellessere_users_loc on bellessere_users (location_id);

create table if not exists bellessere_groups (
  id           text primary key,              -- GHL calendar group ID
  location_id  text not null,
  name         text,
  synced_at    timestamptz default now()
);
create index if not exists idx_bellessere_groups_loc on bellessere_groups (location_id);

create table if not exists bellessere_services (
  id             text primary key,            -- GHL calendar ID
  location_id    text not null,
  name           text,
  description    text,
  slot_duration  int,
  slot_interval  int,
  slot_buffer    int,
  pre_buffer     int,
  price          numeric,
  group_id       text,
  team_members   jsonb default '[]',          -- [{ userId }]
  is_active      boolean default true,
  synced_at      timestamptz default now()
);
create index if not exists idx_bellessere_services_loc on bellessere_services (location_id);

create table if not exists bellessere_schedules (
  id           text primary key,              -- GHL schedule ID
  location_id  text not null,
  user_id      text not null,
  name         text,
  rules        jsonb default '[]',            -- [{ type, day, intervals }]
  timezone     text default 'Europe/Rome',
  synced_at    timestamptz default now()
);
create index if not exists idx_bellessere_schedules_loc_user on bellessere_schedules (location_id, user_id);
