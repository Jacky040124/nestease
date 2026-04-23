/**
 * Agent Manager: manages Agent lifecycle (one Agent per PM).
 */

import { client } from "../lib/anthropic-client.js";
import { supabase } from "../lib/supabase.js";
import { buildSystemPrompt } from "./prompt-builder.js";
import { CUSTOM_TOOLS } from "./tool-definitions.js";
import { AGENT_MODEL, COMPANY_NAME } from "../config/constants.js";

/**
 * Get or create an Agent for a PM.
 * Phase 1 MVP: one PM (Jacky), hardcoded property list. Phase 2: dynamic per PM.
 */
export async function getOrCreateAgent(pmId: string): Promise<string> {
  // Check DB for existing agent
  const { data: existing } = await supabase
    .from("agent_sessions")
    .select("agent_id")
    .eq("pm_id", pmId)
    .not("agent_id", "is", null)
    .limit(1)
    .single();

  if (existing?.agent_id) {
    return existing.agent_id;
  }

  // Look up PM info including agent config
  const { data: pm } = await supabase.from("pm").select("name, email, agent_name, agent_tone").eq("id", pmId).single();
  const pmName = pm?.name || "PM";
  const agentName = pm?.agent_name || "小栖";
  const agentTone = pm?.agent_tone || "friendly";

  // Create new Agent
  const agent = await client.beta.agents.create({
    name: `${agentName}-${pmName}`,
    model: AGENT_MODEL,
    system: buildSystemPrompt(pmName, COMPANY_NAME, "测试物业", agentName, agentTone),
    tools: CUSTOM_TOOLS,
  });

  console.log(`[AgentMgr] Created Agent for PM ${pmName}: ${agent.id}`);
  return agent.id;
}
