-- Add multi-photo support to property table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property' AND column_name='photos') THEN
    ALTER TABLE property ADD COLUMN photos TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- Migrate existing cover_image to photos array
UPDATE property SET photos = ARRAY[cover_image]
  WHERE cover_image IS NOT NULL AND (photos IS NULL OR photos = '{}');
