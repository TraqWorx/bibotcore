-- Rename design slug gym-modern → simfonia
-- Must drop FK constraints first, update, then re-add them.

-- Drop FK constraints that reference designs(slug)
ALTER TABLE installs         DROP CONSTRAINT IF EXISTS installs_design_fk;
ALTER TABLE plan_design_map  DROP CONSTRAINT IF EXISTS plan_design_map_design_slug_fkey;
ALTER TABLE design_configs   DROP CONSTRAINT IF EXISTS design_configs_design_slug_fkey;
ALTER TABLE design_versions  DROP CONSTRAINT IF EXISTS design_versions_design_slug_fkey;

-- Rename the slug everywhere
UPDATE designs          SET slug        = 'simfonia' WHERE slug        = 'gym-modern';
UPDATE installs         SET design_slug = 'simfonia' WHERE design_slug = 'gym-modern';
UPDATE plan_design_map  SET design_slug = 'simfonia' WHERE design_slug = 'gym-modern';
UPDATE design_configs   SET design_slug = 'simfonia' WHERE design_slug = 'gym-modern';
UPDATE design_versions  SET design_slug = 'simfonia' WHERE design_slug = 'gym-modern';

-- Re-add FK constraints
ALTER TABLE installs        ADD CONSTRAINT installs_design_fk                  FOREIGN KEY (design_slug) REFERENCES designs(slug) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE plan_design_map ADD CONSTRAINT plan_design_map_design_slug_fkey    FOREIGN KEY (design_slug) REFERENCES designs(slug) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE design_configs  ADD CONSTRAINT design_configs_design_slug_fkey     FOREIGN KEY (design_slug) REFERENCES designs(slug) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE design_versions ADD CONSTRAINT design_versions_design_slug_fkey    FOREIGN KEY (design_slug) REFERENCES designs(slug) ON UPDATE CASCADE ON DELETE CASCADE;
