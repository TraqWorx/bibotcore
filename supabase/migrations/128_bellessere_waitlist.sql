-- Bellessere waiting list: customers register a preferred service/operator/day-time;
-- when a booking is cancelled and a matching slot frees up, they are invited (drip,
-- first-in-line) to book. Staff can also invite manually from the Lista d'attesa module.

create table if not exists bellessere_waitlist (
  id              uuid primary key default gen_random_uuid(),
  location_id     text not null,
  contact_ghl_id  text,                         -- GHL contact (upserted on capture)
  first_name      text,
  last_name       text,
  phone           text,
  email           text,
  calendar_id     text not null,                -- desired service (GHL calendar id)
  service_name    text,
  operator_id     text,                         -- preferred operator; null = any operator
  preferred_date  date not null,                -- desired day
  time_pref       text not null default 'any',  -- 'any' | 'morning' | 'afternoon' | 'specific'
  preferred_from  time,                         -- window start when time_pref = 'specific'
  preferred_to    time,                         -- window end when time_pref = 'specific'
  status          text not null default 'waiting', -- waiting | invited | booked | expired | cancelled
  invited_at      timestamptz,
  hold_until      timestamptz,                  -- invite expiry; after this we drip to the next
  notified_count  int not null default 0,
  booked_event_id text,
  note            text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_bellessere_waitlist_loc_status
  on bellessere_waitlist (location_id, status);
create index if not exists idx_bellessere_waitlist_match
  on bellessere_waitlist (location_id, calendar_id, preferred_date, status);
create index if not exists idx_bellessere_waitlist_hold
  on bellessere_waitlist (status, hold_until);
