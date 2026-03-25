-- Gare Mensili: monthly competition targets per operator category per location
CREATE TABLE IF NOT EXISTS gare_mensili (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id TEXT NOT NULL,
  month DATE NOT NULL,              -- first day of month, e.g. '2026-03-01'
  categoria TEXT NOT NULL,          -- e.g. 'SIM Fastweb', 'SIM WindTre', 'Linee Fibra'
  obiettivo INTEGER NOT NULL DEFAULT 0,
  tag TEXT NOT NULL,                -- GHL tag used to count activations
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, month, categoria)
);
