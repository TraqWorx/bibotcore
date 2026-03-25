-- Automation execution log
CREATE TABLE IF NOT EXISTS automation_executions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id  uuid NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  location_id    text NOT NULL,
  event_type     text NOT NULL,
  webhook_event_id uuid REFERENCES ghl_webhook_events(id) ON DELETE SET NULL,
  status         text NOT NULL DEFAULT 'running', -- 'running' | 'completed' | 'failed'
  error          text,
  executed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_executions_automation_idx ON automation_executions (automation_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS automation_executions_location_idx ON automation_executions (location_id, executed_at DESC);
