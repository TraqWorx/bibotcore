-- ============================================================
-- notifications: per-user CRM event notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  location_id text,
  type        text        NOT NULL,
  title       text        NOT NULL,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  read        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx     ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx  ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx      ON notifications (user_id, read) WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Service role can insert (createNotification uses service role client)
CREATE POLICY "Service role insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- activity_feed: location-scoped CRM event log
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_feed (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text        NOT NULL,
  type        text        NOT NULL,
  entity_type text,
  entity_id   text,
  data        jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_feed_location_idx    ON activity_feed (location_id);
CREATE INDEX IF NOT EXISTS activity_feed_created_at_idx  ON activity_feed (created_at DESC);

ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own location activity"
  ON activity_feed FOR SELECT
  USING (
    location_id IN (
      SELECT location_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role insert activity"
  ON activity_feed FOR INSERT
  WITH CHECK (true);
