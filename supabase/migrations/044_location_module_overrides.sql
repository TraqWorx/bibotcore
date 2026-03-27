-- Per-location module overrides (enable/disable features per location)
ALTER TABLE location_design_settings
  ADD COLUMN IF NOT EXISTS module_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
