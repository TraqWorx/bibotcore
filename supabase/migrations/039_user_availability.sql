-- Per-user availability windows for calendar scheduling
CREATE TABLE IF NOT EXISTS user_availability (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text        NOT NULL,
  ghl_user_id text        NOT NULL,
  day_of_week smallint    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Mon, 6=Sun
  start_time  time        NOT NULL DEFAULT '09:00',
  end_time    time        NOT NULL DEFAULT '18:00',
  enabled     boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, ghl_user_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS user_availability_location_idx ON user_availability (location_id);
CREATE INDEX IF NOT EXISTS user_availability_user_idx ON user_availability (location_id, ghl_user_id);
