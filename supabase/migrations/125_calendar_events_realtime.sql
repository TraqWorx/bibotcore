-- Add user_id to cached_calendar_events so staff-filter queries work from cache
ALTER TABLE cached_calendar_events ADD COLUMN IF NOT EXISTS user_id text;
CREATE INDEX IF NOT EXISTS idx_cached_cal_events_user
  ON cached_calendar_events (location_id, user_id);

-- Enable Supabase real-time so browser clients receive instant push on INSERT/UPDATE/DELETE
ALTER TABLE cached_calendar_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE cached_calendar_events;
