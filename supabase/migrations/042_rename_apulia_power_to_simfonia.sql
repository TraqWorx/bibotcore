-- Rename design slug from apulia-power to simfonia
UPDATE designs SET slug = 'simfonia', name = 'Simfonia' WHERE slug = 'apulia-power';

-- Update installs referencing the old slug
UPDATE installs SET design_slug = 'simfonia' WHERE design_slug = 'apulia-power';
