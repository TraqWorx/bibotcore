-- Provvigioni (commission) rules per location
CREATE TABLE IF NOT EXISTS provvigioni (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL,
  nome        text NOT NULL,                          -- e.g. "Gettone Energia Standard"
  tipo        text NOT NULL DEFAULT 'fisso',          -- 'fisso' or 'percentuale'
  valore      numeric NOT NULL DEFAULT 0,             -- fixed € amount or % value
  ordine      int NOT NULL DEFAULT 0,                 -- display order
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provvigioni_location ON provvigioni (location_id);
