-- Phase 2A: Contractor Authentication
-- PM Code + SMS OTP Registration + Login

-- 1. Add pm_code to pm table (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pm' AND column_name='pm_code') THEN
    ALTER TABLE pm ADD COLUMN pm_code TEXT UNIQUE;
  END IF;
END $$;

-- Generate 6-char alphanumeric codes for existing PMs
UPDATE pm SET pm_code = upper(substr(md5(random()::text), 1, 6))
  WHERE pm_code IS NULL;

DO $$ BEGIN
  ALTER TABLE pm ALTER COLUMN pm_code SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- 2. Add auth fields to contractor table (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contractor' AND column_name='auth_id') THEN
    ALTER TABLE contractor ADD COLUMN auth_id UUID UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contractor' AND column_name='registered_at') THEN
    ALTER TABLE contractor ADD COLUMN registered_at TIMESTAMPTZ;
  END IF;
END $$;

-- 3. Create OTP table (idempotent)
CREATE TABLE IF NOT EXISTS contractor_otp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contractor_otp_phone_expires ON contractor_otp(phone, expires_at);

-- 4. Clean up ALL mockup data (FK-safe order: children first)
DELETE FROM notification;
DELETE FROM work_order_status_history;
-- Clear FK references on work_order before deleting related tables
UPDATE work_order SET quote_id = NULL, completion_report_id = NULL;
DELETE FROM completion_report;
DELETE FROM quote;
DELETE FROM work_order;
DELETE FROM contractor_note;
DELETE FROM contractor_rating;
DELETE FROM contractor;
