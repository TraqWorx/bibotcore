-- Make nullable columns that aren't needed for agency-token connections
ALTER TABLE ghl_connections
  ALTER COLUMN package_slug DROP NOT NULL,
  ALTER COLUMN refresh_token DROP NOT NULL;
