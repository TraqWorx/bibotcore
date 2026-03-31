-- ============================================================
-- 055: Cached conversation messages + appointment queue
-- Messages cached in Supabase so conversations work when GHL is down.
-- Appointment queue for async creation with GHL retry.
-- ============================================================

-- Cached conversation messages
CREATE TABLE IF NOT EXISTS cached_messages (
  ghl_id           text NOT NULL,
  location_id      text NOT NULL,
  conversation_id  text NOT NULL,
  contact_ghl_id   text,
  body             text,
  direction        text,
  type             text,
  status           text,
  date_added       timestamptz,
  synced_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, ghl_id)
);

CREATE INDEX IF NOT EXISTS idx_cached_messages_convo
  ON cached_messages (location_id, conversation_id, date_added ASC);

-- Appointment creation queue (write to Supabase first, sync to GHL async)
CREATE TABLE IF NOT EXISTS appointment_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     text NOT NULL,
  calendar_id     text NOT NULL,
  contact_ghl_id  text,
  title           text,
  start_time      timestamptz NOT NULL,
  end_time        timestamptz NOT NULL,
  created_by      uuid REFERENCES auth.users(id),
  status          text NOT NULL DEFAULT 'pending',
  ghl_event_id    text,
  error           text,
  attempts        int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_queue_pending
  ON appointment_queue (status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_appointment_queue_location
  ON appointment_queue (location_id, created_at DESC);

-- Enable RLS
ALTER TABLE cached_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_queue ENABLE ROW LEVEL SECURITY;
