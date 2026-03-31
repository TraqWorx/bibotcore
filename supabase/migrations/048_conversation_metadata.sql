-- Store conversation metadata that GHL doesn't return in its API
CREATE TABLE IF NOT EXISTS conversation_metadata (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id text NOT NULL,
  conversation_id text NOT NULL,
  assigned_to text, -- GHL user ID
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(location_id, conversation_id)
);

-- Store note author info since GHL notes API returns userId=null for API-created notes
CREATE TABLE IF NOT EXISTS note_authors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id text NOT NULL,
  contact_id text NOT NULL,
  note_id text NOT NULL,
  author_user_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(location_id, note_id)
);

-- Enable RLS
ALTER TABLE conversation_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_authors ENABLE ROW LEVEL SECURITY;

-- Policies: allow authenticated users to read/write
CREATE POLICY "Allow authenticated read conversation_metadata" ON conversation_metadata FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert conversation_metadata" ON conversation_metadata FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update conversation_metadata" ON conversation_metadata FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read note_authors" ON note_authors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert note_authors" ON note_authors FOR INSERT TO authenticated WITH CHECK (true);
