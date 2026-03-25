-- Add preview_image column to designs
ALTER TABLE designs
  ADD COLUMN IF NOT EXISTS preview_image text; -- URL or path to preview image
