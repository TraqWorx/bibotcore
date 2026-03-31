-- ============================================================
-- 051: End-User Portal
-- Maps Supabase auth users (end customers) to their GHL contact record.
-- Portal users log in via email/phone OTP and can only see their own data.
-- ============================================================

CREATE TABLE IF NOT EXISTS portal_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id     text NOT NULL,
  contact_ghl_id  text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(auth_user_id),
  UNIQUE(location_id, contact_ghl_id)
);

CREATE INDEX IF NOT EXISTS idx_portal_users_location
  ON portal_users (location_id);

-- Enable RLS
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;

-- Portal users can read their own mapping
CREATE POLICY "Portal users read own record"
  ON portal_users FOR SELECT
  USING (auth_user_id = auth.uid());

-- ── RLS policies for cached tables: portal users see their own contact ──────

-- Portal users can read their own cached contact
CREATE POLICY "Portal users read own contact"
  ON cached_contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM portal_users pu
      WHERE pu.auth_user_id = auth.uid()
      AND pu.contact_ghl_id = cached_contacts.ghl_id
      AND pu.location_id = cached_contacts.location_id
    )
  );

-- Portal users can read their own custom fields
CREATE POLICY "Portal users read own custom fields"
  ON cached_contact_custom_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM portal_users pu
      WHERE pu.auth_user_id = auth.uid()
      AND pu.contact_ghl_id = cached_contact_custom_fields.contact_ghl_id
      AND pu.location_id = cached_contact_custom_fields.location_id
    )
  );

-- Portal users can read their own opportunities
CREATE POLICY "Portal users read own opportunities"
  ON cached_opportunities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM portal_users pu
      WHERE pu.auth_user_id = auth.uid()
      AND pu.contact_ghl_id = cached_opportunities.contact_ghl_id
      AND pu.location_id = cached_opportunities.location_id
    )
  );

-- Portal users can read their own conversations
CREATE POLICY "Portal users read own conversations"
  ON cached_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM portal_users pu
      WHERE pu.auth_user_id = auth.uid()
      AND pu.contact_ghl_id = cached_conversations.contact_ghl_id
      AND pu.location_id = cached_conversations.location_id
    )
  );

-- Portal users can read their own tasks
CREATE POLICY "Portal users read own tasks"
  ON cached_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM portal_users pu
      WHERE pu.auth_user_id = auth.uid()
      AND pu.contact_ghl_id = cached_tasks.contact_ghl_id
      AND pu.location_id = cached_tasks.location_id
    )
  );

-- Portal users can read their own notes
CREATE POLICY "Portal users read own notes"
  ON cached_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM portal_users pu
      WHERE pu.auth_user_id = auth.uid()
      AND pu.contact_ghl_id = cached_notes.contact_ghl_id
      AND pu.location_id = cached_notes.location_id
    )
  );
