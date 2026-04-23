-- ============================================================
-- NestEase — Initial Database Schema
-- Based on PRD v1
-- ============================================================

-- ── Enums ───────────────────────────────────────────────────

CREATE TYPE work_order_status AS ENUM (
  'pending_assignment',
  'assigned',
  'quoting',
  'pending_approval',
  'in_progress',
  'pending_verification',
  'completed',
  'cancelled',
  'on_hold'
);

CREATE TYPE urgency AS ENUM ('normal', 'urgent');

CREATE TYPE category AS ENUM ('plumbing', 'electrical', 'hvac', 'locks', 'other');

CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE follow_up_status AS ENUM (
  'pending_confirmation',
  'confirmed',
  'has_issue',
  'auto_completed'
);

CREATE TYPE work_type AS ENUM ('replacement', 'repair', 'cleaning', 'other');

CREATE TYPE notification_channel AS ENUM ('sms', 'wechat', 'email');

CREATE TYPE user_role AS ENUM ('pm', 'tenant', 'contractor', 'owner');

-- ── Users (managed by Supabase Auth) ────────────────────────

CREATE TABLE pm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  auto_approval_enabled BOOLEAN DEFAULT false,
  auto_approval_threshold NUMERIC(10,2) DEFAULT 300.00,
  follow_up_wait_days INTEGER DEFAULT 10,
  notification_channel notification_channel DEFAULT 'sms',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE owner (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE property (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  unit TEXT,
  owner_id UUID NOT NULL REFERENCES owner(id),
  pm_id UUID NOT NULL REFERENCES pm(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tenant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  property_id UUID NOT NULL REFERENCES property(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE contractor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  specialties category[] DEFAULT '{}',
  pm_id UUID NOT NULL REFERENCES pm(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Work Orders ─────────────────────────────────────────────

CREATE TABLE work_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status work_order_status NOT NULL DEFAULT 'pending_assignment',

  -- Property info
  property_id UUID NOT NULL REFERENCES property(id),
  property_address TEXT NOT NULL,
  unit TEXT,

  -- Tenant info
  tenant_id UUID NOT NULL REFERENCES tenant(id),
  tenant_name TEXT NOT NULL,
  tenant_phone TEXT NOT NULL,

  -- Problem description
  category category NOT NULL,
  description TEXT NOT NULL,
  photos TEXT[] DEFAULT '{}',
  urgency urgency NOT NULL DEFAULT 'normal',

  -- Assignment
  contractor_id UUID REFERENCES contractor(id),
  assigned_at TIMESTAMPTZ,

  -- Approval
  approval_required BOOLEAN DEFAULT false,
  approval_status approval_status,
  approved_by UUID REFERENCES owner(id),
  approved_at TIMESTAMPTZ,
  pm_recommendation TEXT,

  -- Completion
  completed_at TIMESTAMPTZ,

  -- Follow-up
  follow_up_status follow_up_status,
  follow_up_sent_at TIMESTAMPTZ,
  follow_up_deadline TIMESTAMPTZ,

  -- Hold
  held_from_status work_order_status,

  -- Relations
  parent_work_order_id UUID REFERENCES work_order(id),
  owner_id UUID NOT NULL REFERENCES owner(id),
  pm_id UUID NOT NULL REFERENCES pm(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Quotes ──────────────────────────────────────────────────

CREATE TABLE quote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_order(id),
  contractor_id UUID NOT NULL REFERENCES contractor(id),

  labor_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  labor_rate NUMERIC(8,2) NOT NULL DEFAULT 0,
  labor_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  materials JSONB DEFAULT '[]',
  materials_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  other_cost NUMERIC(10,2) DEFAULT 0,
  other_description TEXT,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,

  estimated_completion DATE,
  notes TEXT,

  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- ── Completion Reports ──────────────────────────────────────

CREATE TABLE completion_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_order(id),
  contractor_id UUID NOT NULL REFERENCES contractor(id),

  work_type work_type NOT NULL,
  work_description TEXT NOT NULL,

  actual_materials JSONB DEFAULT '[]',
  actual_materials_cost NUMERIC(10,2) DEFAULT 0,
  actual_labor_hours NUMERIC(6,2) DEFAULT 0,
  actual_labor_rate NUMERIC(8,2) DEFAULT 0,
  actual_labor_cost NUMERIC(10,2) DEFAULT 0,
  actual_other_cost NUMERIC(10,2) DEFAULT 0,
  actual_total NUMERIC(10,2) DEFAULT 0,

  completion_photos TEXT[] DEFAULT '{}',
  recommendations TEXT,

  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- ── Status History (audit log) ──────────────────────────────

CREATE TABLE work_order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_order(id),
  from_status work_order_status,
  to_status work_order_status NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID,
  actor_role user_role,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Notifications ───────────────────────────────────────────

CREATE TABLE notification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES work_order(id),
  target_role user_role NOT NULL,
  target_id UUID NOT NULL,
  channel notification_channel NOT NULL,
  event TEXT NOT NULL,
  message TEXT NOT NULL,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────

CREATE INDEX idx_work_order_status ON work_order(status);
CREATE INDEX idx_work_order_pm ON work_order(pm_id);
CREATE INDEX idx_work_order_property ON work_order(property_id);
CREATE INDEX idx_work_order_contractor ON work_order(contractor_id);
CREATE INDEX idx_work_order_tenant ON work_order(tenant_id);
CREATE INDEX idx_work_order_parent ON work_order(parent_work_order_id);
CREATE INDEX idx_quote_work_order ON quote(work_order_id);
CREATE INDEX idx_completion_report_work_order ON completion_report(work_order_id);
CREATE INDEX idx_status_history_work_order ON work_order_status_history(work_order_id);
CREATE INDEX idx_status_history_actor ON work_order_status_history(actor_id);
CREATE INDEX idx_status_history_created ON work_order_status_history(created_at);
CREATE INDEX idx_notification_work_order ON notification(work_order_id);
CREATE INDEX idx_notification_unsent ON notification(sent) WHERE sent = false;

-- ── Updated_at trigger ──────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_order_updated_at
  BEFORE UPDATE ON work_order
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pm_updated_at
  BEFORE UPDATE ON pm
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
