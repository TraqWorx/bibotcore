-- ============================================================
-- automations: user-defined CRM automations per location
-- ============================================================
CREATE TABLE IF NOT EXISTS automations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  text        NOT NULL,
  name         text        NOT NULL,
  trigger_type text        NOT NULL,
  conditions   jsonb       NOT NULL DEFAULT '[]',
  actions      jsonb       NOT NULL DEFAULT '[]',
  active       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automations_location_idx ON automations (location_id);
CREATE INDEX IF NOT EXISTS automations_trigger_idx  ON automations (location_id, trigger_type) WHERE active = true;

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own location automations"
  ON automations FOR ALL
  USING (
    location_id IN (
      SELECT location_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Service role can select (for running automations server-side)
CREATE POLICY "Service role full access"
  ON automations FOR ALL
  USING (true)
  WITH CHECK (true);
