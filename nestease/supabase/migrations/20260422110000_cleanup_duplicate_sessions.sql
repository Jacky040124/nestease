-- Cleanup duplicate active sessions for the same contractor+pm pair.
-- Root cause: race condition during zero-downtime deploys where two instances
-- both created sessions before either inserted, leading to .single() snowball.
-- Keep the most recent active session per contractor+pm, suspend the rest.

WITH ranked AS (
  SELECT
    id,
    contractor_id,
    pm_id,
    session_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY contractor_id, pm_id
      ORDER BY created_at DESC
    ) AS rn
  FROM agent_sessions
  WHERE status = 'active'
)
UPDATE agent_sessions
SET status = 'suspended'
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);
