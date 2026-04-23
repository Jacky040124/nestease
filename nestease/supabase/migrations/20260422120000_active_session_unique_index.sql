-- Prevent duplicate active sessions for the same contractor+pm pair.
-- Partial unique index: only enforced for status = 'active'.
-- This replaces application-level race condition checks with database-level atomicity.
CREATE UNIQUE INDEX agent_sessions_active_unique
ON agent_sessions (contractor_id, pm_id)
WHERE status = 'active';
