-- Add repair_code column to property table for short alphanumeric repair codes
ALTER TABLE property ADD COLUMN IF NOT EXISTS repair_code VARCHAR(8) UNIQUE;

-- Generate repair codes for all existing properties that don't have one
-- Format: alternating letter-digit (e.g., A3K7P2)
DO $$
DECLARE
  prop RECORD;
  new_code VARCHAR(8);
  letters TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  digits TEXT := '23456789';
  attempts INT;
BEGIN
  FOR prop IN SELECT id FROM property WHERE repair_code IS NULL LOOP
    attempts := 0;
    LOOP
      new_code := '';
      FOR i IN 1..6 LOOP
        IF i % 2 = 1 THEN
          new_code := new_code || substr(letters, floor(random() * length(letters))::int + 1, 1);
        ELSE
          new_code := new_code || substr(digits, floor(random() * length(digits))::int + 1, 1);
        END IF;
      END LOOP;
      BEGIN
        UPDATE property SET repair_code = new_code WHERE id = prop.id;
        EXIT; -- success
      EXCEPTION WHEN unique_violation THEN
        attempts := attempts + 1;
        IF attempts > 10 THEN
          RAISE EXCEPTION 'Failed to generate unique repair_code after 10 attempts';
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

-- Make repair_code NOT NULL after backfilling
ALTER TABLE property ALTER COLUMN repair_code SET NOT NULL;

-- Drop the old repair_link column (no longer needed)
ALTER TABLE property DROP COLUMN IF EXISTS repair_link;
