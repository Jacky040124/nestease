-- Agent memories table for contractor profile persistence
CREATE TABLE IF NOT EXISTS agent_memories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id uuid NOT NULL REFERENCES contractor(id),
  pm_id uuid NOT NULL REFERENCES pm(id),
  key text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(contractor_id, pm_id, key)
);

-- Add confirmed column to agent_sessions for onboarding flow
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS confirmed boolean DEFAULT false;
