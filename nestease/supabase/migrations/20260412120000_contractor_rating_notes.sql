-- Contractor management integration: rating, notes, and favorite support

-- 1. Add is_favorite field to contractor table
ALTER TABLE contractor ADD COLUMN is_favorite BOOLEAN DEFAULT false;

-- 2. Contractor rating table
CREATE TABLE contractor_rating (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_order(id),
  contractor_id UUID NOT NULL REFERENCES contractor(id),
  pm_id UUID NOT NULL REFERENCES pm(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(work_order_id)
);

-- 3. Contractor note table
CREATE TABLE contractor_note (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractor(id),
  pm_id UUID NOT NULL REFERENCES pm(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS policies
ALTER TABLE contractor_rating ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_note ENABLE ROW LEVEL SECURITY;

-- PM can only manage their own ratings
CREATE POLICY "pm_manage_own_ratings" ON contractor_rating
  FOR ALL USING (pm_id = auth.uid())
  WITH CHECK (pm_id = auth.uid());

-- PM can only manage their own notes
CREATE POLICY "pm_manage_own_notes" ON contractor_note
  FOR ALL USING (pm_id = auth.uid())
  WITH CHECK (pm_id = auth.uid());

-- 5. Indexes for performance
CREATE INDEX idx_contractor_rating_contractor ON contractor_rating(contractor_id);
CREATE INDEX idx_contractor_rating_pm ON contractor_rating(pm_id);
CREATE INDEX idx_contractor_note_contractor ON contractor_note(contractor_id);
CREATE INDEX idx_contractor_note_pm ON contractor_note(pm_id);
