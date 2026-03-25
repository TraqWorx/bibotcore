-- Add configured flag to installs
-- Set to true once runDesignInstaller has finished for this install
ALTER TABLE installs
  ADD COLUMN IF NOT EXISTS configured boolean NOT NULL DEFAULT false;
