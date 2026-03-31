-- ============================================================
-- 049: GHL Data Cache Tables
-- Mirror GHL CRM data into Supabase for fast reads and
-- resilience when GHL API is slow or down.
-- All tables use composite PK (location_id, ghl_id) for
-- natural upserts and location-scoped queries.
-- ============================================================

-- ============================================================
-- cached_contacts
-- ============================================================
CREATE TABLE IF NOT EXISTS cached_contacts (
  ghl_id           text NOT NULL,
  location_id      text NOT NULL,
  first_name       text,
  last_name        text,
  email            text,
  phone            text,
  company_name     text,
  address1         text,
  city             text,
  tags             text[] DEFAULT '{}',
  date_added       timestamptz,
  last_activity    timestamptz,
  ghl_updated_at   timestamptz,
  synced_at        timestamptz NOT NULL DEFAULT now(),
  raw              jsonb,
  PRIMARY KEY (location_id, ghl_id)
);

CREATE INDEX IF NOT EXISTS idx_cached_contacts_email
  ON cached_contacts (location_id, email);
CREATE INDEX IF NOT EXISTS idx_cached_contacts_phone
  ON cached_contacts (location_id, phone);
CREATE INDEX IF NOT EXISTS idx_cached_contacts_date_added
  ON cached_contacts (location_id, date_added DESC);
CREATE INDEX IF NOT EXISTS idx_cached_contacts_tags
  ON cached_contacts USING GIN (tags);

-- ============================================================
-- cached_contact_custom_fields (EAV for custom field values)
-- ============================================================
CREATE TABLE IF NOT EXISTS cached_contact_custom_fields (
  location_id      text NOT NULL,
  contact_ghl_id   text NOT NULL,
  field_id         text NOT NULL,
  field_key        text,
  value            text,
  PRIMARY KEY (location_id, contact_ghl_id, field_id),
  FOREIGN KEY (location_id, contact_ghl_id)
    REFERENCES cached_contacts (location_id, ghl_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cached_cf_field_value
  ON cached_contact_custom_fields (location_id, field_id, value);

-- ============================================================
-- cached_opportunities
-- ============================================================
CREATE TABLE IF NOT EXISTS cached_opportunities (
  ghl_id              text NOT NULL,
  location_id         text NOT NULL,
  name                text,
  pipeline_id         text,
  pipeline_stage_id   text,
  contact_ghl_id      text,
  monetary_value      numeric,
  status              text,
  assigned_to         text,
  ghl_updated_at      timestamptz,
  synced_at           timestamptz NOT NULL DEFAULT now(),
  raw                 jsonb,
  PRIMARY KEY (location_id, ghl_id)
);

CREATE INDEX IF NOT EXISTS idx_cached_opps_pipeline
  ON cached_opportunities (location_id, pipeline_id, pipeline_stage_id);
CREATE INDEX IF NOT EXISTS idx_cached_opps_contact
  ON cached_opportunities (location_id, contact_ghl_id);
CREATE INDEX IF NOT EXISTS idx_cached_opps_status
  ON cached_opportunities (location_id, status);

-- ============================================================
-- cached_pipelines
-- ============================================================
CREATE TABLE IF NOT EXISTS cached_pipelines (
  ghl_id         text NOT NULL,
  location_id    text NOT NULL,
  name           text,
  stages         jsonb DEFAULT '[]'::jsonb,
  synced_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, ghl_id)
);

-- ============================================================
-- cached_conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS cached_conversations (
  ghl_id                   text NOT NULL,
  location_id              text NOT NULL,
  contact_ghl_id           text,
  contact_name             text,
  type                     text,
  last_message_body        text,
  last_message_date        timestamptz,
  last_message_direction   text,
  unread_count             int DEFAULT 0,
  assigned_to              text,
  synced_at                timestamptz NOT NULL DEFAULT now(),
  raw                      jsonb,
  PRIMARY KEY (location_id, ghl_id)
);

CREATE INDEX IF NOT EXISTS idx_cached_convos_contact
  ON cached_conversations (location_id, contact_ghl_id);
CREATE INDEX IF NOT EXISTS idx_cached_convos_last_msg
  ON cached_conversations (location_id, last_message_date DESC);

-- ============================================================
-- cached_tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS cached_tasks (
  ghl_id           text NOT NULL,
  location_id      text NOT NULL,
  contact_ghl_id   text NOT NULL,
  title            text,
  due_date         timestamptz,
  completed        boolean DEFAULT false,
  synced_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, ghl_id)
);

CREATE INDEX IF NOT EXISTS idx_cached_tasks_contact
  ON cached_tasks (location_id, contact_ghl_id);

-- ============================================================
-- cached_notes
-- ============================================================
CREATE TABLE IF NOT EXISTS cached_notes (
  ghl_id           text NOT NULL,
  location_id      text NOT NULL,
  contact_ghl_id   text NOT NULL,
  body             text,
  date_added       timestamptz,
  created_by       text,
  synced_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, ghl_id)
);

CREATE INDEX IF NOT EXISTS idx_cached_notes_contact
  ON cached_notes (location_id, contact_ghl_id);

-- ============================================================
-- cached_custom_fields (location-level field definitions)
-- ============================================================
CREATE TABLE IF NOT EXISTS cached_custom_fields (
  field_id          text NOT NULL,
  location_id       text NOT NULL,
  name              text,
  field_key         text,
  data_type         text,
  placeholder       text,
  picklist_options  text[] DEFAULT '{}',
  synced_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, field_id)
);

-- ============================================================
-- sync_status — tracks per-location, per-entity sync state
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_status (
  location_id    text NOT NULL,
  entity_type    text NOT NULL,
  last_synced_at timestamptz,
  status         text NOT NULL DEFAULT 'pending',
  error          text,
  cursor         text,
  PRIMARY KEY (location_id, entity_type)
);

-- ============================================================
-- Enable RLS on all new tables (service-role-only, no public policies)
-- ============================================================
ALTER TABLE cached_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_contact_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;
