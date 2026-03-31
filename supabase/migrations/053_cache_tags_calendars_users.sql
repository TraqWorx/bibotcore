-- ============================================================
-- 053: Cache tags, calendar events, calendars, and GHL users
-- Completes the GHL data cache so the app works when GHL is down.
-- ============================================================

-- Tags
CREATE TABLE IF NOT EXISTS cached_tags (
  ghl_id       text NOT NULL,
  location_id  text NOT NULL,
  name         text NOT NULL,
  synced_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, ghl_id)
);

-- Calendars
CREATE TABLE IF NOT EXISTS cached_calendars (
  ghl_id       text NOT NULL,
  location_id  text NOT NULL,
  name         text,
  synced_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, ghl_id)
);

-- Calendar events
CREATE TABLE IF NOT EXISTS cached_calendar_events (
  ghl_id              text NOT NULL,
  location_id         text NOT NULL,
  calendar_id         text,
  contact_ghl_id      text,
  title               text,
  start_time          timestamptz,
  end_time            timestamptz,
  appointment_status  text,
  synced_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, ghl_id)
);

CREATE INDEX IF NOT EXISTS idx_cached_cal_events_contact
  ON cached_calendar_events (location_id, contact_ghl_id);
CREATE INDEX IF NOT EXISTS idx_cached_cal_events_time
  ON cached_calendar_events (location_id, start_time DESC);

-- GHL users (staff members per location)
CREATE TABLE IF NOT EXISTS cached_ghl_users (
  ghl_id       text NOT NULL,
  location_id  text NOT NULL,
  name         text,
  first_name   text,
  last_name    text,
  email        text,
  role         text,
  synced_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, ghl_id)
);

-- Enable RLS (service-role-only)
ALTER TABLE cached_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_ghl_users ENABLE ROW LEVEL SECURITY;
