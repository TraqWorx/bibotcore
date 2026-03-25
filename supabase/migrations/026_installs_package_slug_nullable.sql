-- Make installs.package_slug nullable so admin-OAuth-connected locations
-- (which have no package) can have a design_slug without a package_slug.
ALTER TABLE installs
  ALTER COLUMN package_slug DROP NOT NULL;
