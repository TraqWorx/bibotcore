-- Add user_id to installs for multi-location user support
ALTER TABLE installs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS installs_user_id_idx ON installs (user_id);
