-- Add notes column to property table for free-form markdown notes
ALTER TABLE property ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
