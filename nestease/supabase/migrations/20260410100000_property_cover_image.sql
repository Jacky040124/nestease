-- Add cover image and description to property table
ALTER TABLE property ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE property ADD COLUMN IF NOT EXISTS description TEXT;
