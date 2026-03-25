-- GHL inbound webhook events
CREATE TABLE IF NOT EXISTS ghl_webhook_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL,
  event_type  text NOT NULL,
  payload     jsonb NOT NULL,
  processed   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ghl_webhook_events_location_idx ON ghl_webhook_events (location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ghl_webhook_events_unprocessed_idx ON ghl_webhook_events (processed, created_at) WHERE processed = false;
