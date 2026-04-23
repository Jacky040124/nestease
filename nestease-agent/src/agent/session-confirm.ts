/**
 * Session confirmation: marks a session as identity-verified.
 * Separated to avoid circular dependency between session-manager and tool-handlers.
 */

import { supabase } from "../lib/supabase.js";

export async function confirmSession(contractorId: string, pmId: string): Promise<void> {
  await supabase
    .from("agent_sessions")
    .update({ confirmed: true })
    .eq("contractor_id", contractorId)
    .eq("pm_id", pmId)
    .eq("status", "active");
}
