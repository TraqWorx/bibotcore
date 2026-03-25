-- Add theme + modules to designs, and per-location user overrides table
ALTER TABLE designs
  ADD COLUMN IF NOT EXISTS theme   jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS modules jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS location_design_settings (
  location_id     text PRIMARY KEY,
  theme_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Seed gym-modern with Apulia Power defaults
UPDATE designs SET
  theme = '{"primaryColor":"#2A00CC","secondaryColor":"#00F0FF","companyName":"Apulia Power","logoText":"AP"}',
  modules = '{
    "dashboard":{"enabled":true,"config":{"tagCategories":[
      {"label":"Telefonia","tag":"telefonia","color":"blue"},
      {"label":"Energia","tag":"energia","color":"amber"},
      {"label":"Connettività","tag":"connettivita","color":"green"},
      {"label":"Intrattenimento","tag":"intrattenimento","color":"purple"}
    ]}},
    "contacts":{"enabled":true},
    "pipeline":{"enabled":true},
    "calendar":{"enabled":true},
    "automations":{"enabled":true},
    "settings":{"enabled":true}
  }'
WHERE slug = 'gym-modern';
