-- Add assigned_to column to cached_contacts for fast per-user filtering
ALTER TABLE cached_contacts ADD COLUMN IF NOT EXISTS assigned_to text;
CREATE INDEX IF NOT EXISTS idx_cached_contacts_assigned ON cached_contacts (location_id, assigned_to);
