/**
 * Environment Manager: manages the shared Claude environment.
 */

import { client } from "../lib/anthropic-client.js";
import { supabase } from "../lib/supabase.js";

let sharedEnvironmentId: string | null = null;

export async function getOrCreateEnvironment(): Promise<string> {
  if (sharedEnvironmentId) return sharedEnvironmentId;

  // Check if we have one stored
  const { data: existing } = await supabase
    .from("agent_sessions")
    .select("environment_id")
    .not("environment_id", "is", null)
    .limit(1)
    .single();

  if (existing?.environment_id) {
    sharedEnvironmentId = existing.environment_id;
    return sharedEnvironmentId!;
  }

  // Create new environment
  const env = await client.beta.environments.create({
    name: `lobster-env-${Date.now()}`,
    config: { type: "cloud", networking: { type: "unrestricted" } },
  });
  sharedEnvironmentId = env.id;
  console.log(`[EnvMgr] Created environment: ${env.id}`);
  return env.id;
}
