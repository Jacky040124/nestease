/**
 * Session Manager: manages Session lifecycle and message processing for the AI Agent.
 *
 * Architecture: one Agent per PM, one Session per (contractor, PM) pair.
 * Single-active-session model: only one session per phone number is active at a time.
 * When a new PM assigns work, the old session is suspended.
 * Sessions persist across messages — contractor texts in, we find the active session,
 * send message, stream response, handle tool calls, send SMS replies.
 */

import { client } from "../lib/anthropic-client.js";
import { supabase } from "../lib/supabase.js";
import { handleToolCall } from "./tool-handlers.js";
import { getOrCreateAgent } from "./agent-manager.js";
import { getOrCreateEnvironment } from "./environment-manager.js";
import { SMS_UNKNOWN_PHONE, SMS_NO_ACTIVE_ORDERS, TIMEZONE } from "../config/constants.js";
import { normalizePhone, phoneVariants } from "../lib/phone.js";

/** Tools that carry a work_order_id in their input */
const WORK_ORDER_TOOLS = new Set([
  "accept_work_order",
  "submit_quote",
  "submit_completion",
  "get_work_order",
  "notify_pm",
]);

// In-memory cache of active sessions: sms_number → session info
const sessionCache = new Map<
  string,
  {
    sessionId: string;
    agentId: string;
    environmentId: string;
    contractorId: string;
    pmId: string;
  }
>();

/**
 * Find or create an Agent Session for a contractor.
 * Returns isNew=true if this is a brand new session (for onboarding flow).
 */
async function getOrCreateSession(
  contractorId: string,
  pmId: string,
  smsNumber: string,
): Promise<{ sessionId: string; agentId: string; environmentId: string; isNew: boolean; confirmed: boolean }> {
  // Check cache first — validate contractorId + pmId to avoid cross-PM routing
  // when the same phone number is registered under multiple PMs.
  const cached = sessionCache.get(smsNumber);
  if (cached && cached.contractorId === contractorId && cached.pmId === pmId) {
    return { ...cached, isNew: false, confirmed: true };
  }

  // Check DB — use .maybeSingle() instead of .single() to handle duplicates gracefully.
  // .single() errors when 0 or >1 rows, which causes a snowball: each failure creates
  // yet another session, making future .single() calls fail even harder.
  const { data: existing } = await supabase
    .from("agent_sessions")
    .select("session_id, agent_id, environment_id, confirmed, id")
    .eq("contractor_id", contractorId)
    .eq("pm_id", pmId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.session_id && existing?.agent_id) {
    const result = {
      sessionId: existing.session_id,
      agentId: existing.agent_id,
      environmentId: existing.environment_id || "",
    };
    sessionCache.set(smsNumber, { ...result, contractorId, pmId });

    // Background cleanup: suspend any older duplicate active sessions
    cleanupDuplicateSessions(contractorId, pmId, existing.id);

    return { ...result, isNew: false, confirmed: existing.confirmed ?? true };
  }

  // Create new session
  const agentId = await getOrCreateAgent(pmId);
  const environmentId = await getOrCreateEnvironment();

  const session = await client.beta.sessions.create({
    agent: agentId,
    environment_id: environmentId,
  });

  // Store in DB (confirmed=false for new sessions, onboarding pending).
  // Partial unique index (contractor_id, pm_id) WHERE status='active' prevents duplicates.
  // If another instance raced us, the INSERT will fail — we re-query and use the winner.
  const { error: insertErr } = await supabase.from("agent_sessions").insert({
    contractor_id: contractorId,
    pm_id: pmId,
    agent_id: agentId,
    session_id: session.id,
    environment_id: environmentId,
    sms_number: smsNumber,
    status: "active",
    confirmed: false,
  });

  if (insertErr) {
    // Unique constraint conflict — another instance created a session first. Use theirs.
    console.log(`[SessionMgr] Insert conflict for contractor ${contractorId}, using existing session.`);
    const { data: winner } = await supabase
      .from("agent_sessions")
      .select("session_id, agent_id, environment_id, confirmed")
      .eq("contractor_id", contractorId)
      .eq("pm_id", pmId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (winner?.session_id && winner?.agent_id) {
      const result = {
        sessionId: winner.session_id,
        agentId: winner.agent_id,
        environmentId: winner.environment_id || "",
      };
      sessionCache.set(smsNumber, { ...result, contractorId, pmId });
      return { ...result, isNew: false, confirmed: winner.confirmed ?? false };
    }
    // Shouldn't happen, but fall through to return our session anyway
  }

  const result = { sessionId: session.id, agentId, environmentId };
  sessionCache.set(smsNumber, { ...result, contractorId, pmId });
  console.log(`[SessionMgr] Created session for contractor ${contractorId}: ${session.id}`);
  return { ...result, isNew: true, confirmed: false };
}

/**
 * Background cleanup: suspend duplicate active sessions for the same contractor+pm.
 * Keeps the specified session, suspends all others. Runs async (fire-and-forget).
 */
function cleanupDuplicateSessions(contractorId: string, pmId: string, keepId: string) {
  supabase
    .from("agent_sessions")
    .update({ status: "suspended" })
    .eq("contractor_id", contractorId)
    .eq("pm_id", pmId)
    .eq("status", "active")
    .neq("id", keepId)
    .then(({ data, error, count }) => {
      if (error) {
        console.error(`[SessionMgr] Duplicate cleanup error:`, error);
      }
      // count is only available if you pass { count: 'exact' } — just log success
    });
}

// Re-export confirmSession for backwards compatibility
export { confirmSession } from "./session-confirm.js";

/**
 * Invalidate the in-memory session cache for a phone number.
 * Called after suspending sessions in DB so the cache doesn't serve stale entries.
 */
export function invalidateSessionCache(smsNumber: string) {
  sessionCache.delete(smsNumber);
}

/**
 * Process an inbound message from a contractor through the Agent.
 * Returns the Agent's text reply to send back via SMS.
 *
 * Routing strategy (single-active-session model):
 * 1. Check agent_sessions for an active session on this phone number
 * 2. If found → route directly (no contractor table lookup needed)
 * 3. If not found → fall back to contractor table lookup, pick the one with active work orders
 * 4. Before returning "no active orders", check suspended sessions for reactivation
 */
export async function processMessage(
  smsNumber: string,
  text: string,
  mediaUrls?: string[],
): Promise<string> {
  const normalizedPhone = normalizePhone(smsNumber);
  const variants = phoneVariants(normalizedPhone);

  // Step 1: Check cache first
  const cached = sessionCache.get(smsNumber);
  let contractorId: string;
  let contractorName: string;
  let sessionId: string;
  let isNew = false;
  let confirmed = true;

  if (cached) {
    // Cache hit — use directly
    contractorId = cached.contractorId;
    sessionId = cached.sessionId;

    // Look up contractor name for message context
    const { data: c } = await supabase
      .from("contractor")
      .select("name")
      .eq("id", contractorId)
      .single();
    contractorName = c?.name || "师傅";
  } else {
    // Step 2: Check agent_sessions for an active session on this phone
    let activeSession: {
      session_id: string;
      agent_id: string;
      environment_id: string | null;
      contractor_id: string;
      pm_id: string;
      confirmed: boolean | null;
    } | null = null;

    const { data: sessionByNormalized } = await supabase
      .from("agent_sessions")
      .select("session_id, agent_id, environment_id, contractor_id, pm_id, confirmed")
      .eq("sms_number", normalizedPhone)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    activeSession = sessionByNormalized;

    if (!activeSession) {
      // Also try with phone variants (sms_number might be stored in different format)
      const { data: sessionByVariant } = await supabase
        .from("agent_sessions")
        .select("session_id, agent_id, environment_id, contractor_id, pm_id, confirmed")
        .in("sms_number", variants)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      activeSession = sessionByVariant;
    }

    if (activeSession?.session_id && activeSession?.agent_id) {
      // Active session found — route directly
      contractorId = activeSession.contractor_id;
      sessionId = activeSession.session_id;
      confirmed = activeSession.confirmed ?? true;

      sessionCache.set(smsNumber, {
        sessionId: activeSession.session_id,
        agentId: activeSession.agent_id,
        environmentId: activeSession.environment_id || "",
        contractorId: activeSession.contractor_id,
        pmId: activeSession.pm_id,
      });

      const { data: c } = await supabase
        .from("contractor")
        .select("name")
        .eq("id", contractorId)
        .single();
      contractorName = c?.name || "师傅";

      console.log(`[SessionMgr] Routed ${smsNumber} to active session ${sessionId} (contractor ${contractorId})`);
    } else {
      // Step 3: No active session — fall back to contractor table lookup
      const { data: contractors } = await supabase
        .from("contractor")
        .select("id, name, pm_id")
        .in("phone", variants)
        .order("created_at", { ascending: false });

      if (!contractors || contractors.length === 0) {
        console.log(`[SessionMgr] Unknown phone number (not in whitelist): ${smsNumber}`);
        return SMS_UNKNOWN_PHONE;
      }

      // Pick the contractor with the most recently updated active work order
      let contractor = contractors[0];

      if (contractors.length > 1) {
        const contractorIds = contractors.map(c => c.id);
        const { data: activeWo } = await supabase
          .from("work_order")
          .select("contractor_id")
          .in("contractor_id", contractorIds)
          .not("status", "in", '("completed","cancelled")')
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeWo) {
          contractor = contractors.find(c => c.id === activeWo.contractor_id) || contractor;
        }
      }

      contractorId = contractor.id;
      contractorName = contractor.name;

      // Check for active work orders on the selected contractor
      const { count } = await supabase
        .from("work_order")
        .select("id", { count: "exact", head: true })
        .eq("contractor_id", contractorId)
        .not("status", "in", '("completed","cancelled")');

      if (!count || count === 0) {
        // Before giving up, check suspended sessions with active work orders
        const reactivated = await tryReactivateSuspendedSession(smsNumber, variants);
        if (reactivated) {
          // Recurse once — reactivated session is now active, so next call hits cache/session lookup (no infinite loop)
          return await processMessage(smsNumber, text, mediaUrls);
        }
        return SMS_NO_ACTIVE_ORDERS;
      }

      // Create session for this contractor
      const result = await getOrCreateSession(contractorId, contractor.pm_id, smsNumber);
      sessionId = result.sessionId;
      isNew = result.isNew;
      confirmed = result.confirmed;

      console.log(`[SessionMgr] Created/found session for ${smsNumber} via contractor lookup (contractor ${contractorId})`);
    }
  }

  // Step 4: Guardrail - verify the active session's contractor still has active work orders
  if (!isNew) {
    const { count } = await supabase
      .from("work_order")
      .select("id", { count: "exact", head: true })
      .eq("contractor_id", contractorId)
      .not("status", "in", '("completed","cancelled")');

    if (!count || count === 0) {
      // Invalidate cache and check for suspended sessions to reactivate
      sessionCache.delete(smsNumber);
      const reactivated = await tryReactivateSuspendedSession(smsNumber, variants);
      if (reactivated) {
        // Recurse once — reactivated session is now active, so next call hits cache (no infinite loop)
        return await processMessage(smsNumber, text, mediaUrls);
      }
      return SMS_NO_ACTIVE_ORDERS;
    }
  }

  // Step 5: Build message with minimal context prefix
  const now = new Date();
  const timeStr = now.toLocaleString("zh-CN", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const onboardingTag = (isNew || !confirmed) ? "\n[首次接触 — 请先自我介绍并确认身份]\n" : "";

  let messageText = `[当前时间: ${timeStr} PDT]\n[师傅: ${contractorName} | ID: ${contractorId}]${onboardingTag}\n\n${text}`;
  if (mediaUrls && mediaUrls.length > 0) {
    messageText += `\n\n[师傅发了 ${mediaUrls.length} 张照片: ${mediaUrls.join(", ")}]`;
  }

  return await sendAndCollectResponse(sessionId, messageText, contractorId);
}

/**
 * Try to find a suspended session with active work orders and reactivate it.
 * Called when the current active session has no work orders left.
 * Returns true if a session was reactivated (caller should retry processMessage).
 */
async function tryReactivateSuspendedSession(
  smsNumber: string,
  phoneFmts: string[],
): Promise<boolean> {
  const { data: suspendedSessions } = await supabase
    .from("agent_sessions")
    .select("session_id, contractor_id, pm_id, agent_id, environment_id, sms_number")
    .in("sms_number", [normalizePhone(smsNumber), ...phoneFmts])
    .eq("status", "suspended");

  if (!suspendedSessions || suspendedSessions.length === 0) return false;

  for (const ss of suspendedSessions) {
    const { count } = await supabase
      .from("work_order")
      .select("id", { count: "exact", head: true })
      .eq("contractor_id", ss.contractor_id)
      .not("status", "in", '("completed","cancelled")');

    if (count && count > 0) {
      // Reactivate this session, suspend the current active one
      console.log(`[SessionMgr] Reactivating suspended session ${ss.session_id} for contractor ${ss.contractor_id}`);

      await supabase
        .from("agent_sessions")
        .update({ status: "suspended" })
        .in("sms_number", [normalizePhone(smsNumber), ...phoneFmts])
        .eq("status", "active");

      await supabase
        .from("agent_sessions")
        .update({ status: "active" })
        .eq("session_id", ss.session_id);

      // Update cache
      sessionCache.set(smsNumber, {
        sessionId: ss.session_id,
        agentId: ss.agent_id,
        environmentId: ss.environment_id || "",
        contractorId: ss.contractor_id,
        pmId: ss.pm_id,
      });

      return true;
    }
  }

  return false;
}

/**
 * Send a system-triggered message to an Agent session (for outbound notifications).
 * Used when work order status changes and we need to notify the contractor.
 */
export async function sendSystemMessage(
  contractorId: string,
  pmId: string,
  smsNumber: string,
  message: string,
  workOrderId?: string,
): Promise<string> {
  const { sessionId, isNew, confirmed } = await getOrCreateSession(contractorId, pmId, smsNumber);

  // For outbound (first dispatch to a new contractor), add onboarding tag
  const onboardingTag = (isNew || !confirmed) ? "\n[首次接触 — 请先自我介绍并确认身份，确认后再发工单详情]\n" : "";

  // Include work_order_id hint so agent knows which order to query
  const woHint = workOrderId ? `\n[相关工单ID: ${workOrderId}]` : "";

  const enrichedMessage = `${onboardingTag}${woHint}\n${message}`;

  return await sendAndCollectResponse(sessionId, enrichedMessage, contractorId, workOrderId);
}

/**
 * Core event loop: send message to Agent session, handle tool calls, collect text response.
 * workOrderId is used to tag conversation logs — passed from system messages,
 * or extracted from tool call inputs when tools reference a specific work order.
 */
async function sendAndCollectResponse(
  sessionId: string,
  messageText: string,
  contractorId: string,
  workOrderId?: string,
): Promise<string> {
  // Mutable — updated when tool calls reference a work order
  let currentWoId = workOrderId || null;

  // Log inbound message immediately
  await supabase.from("agent_conversation_log").insert({
    session_id: sessionId,
    contractor_id: contractorId,
    direction: "inbound",
    message: messageText,
    work_order_id: currentWoId,
  });

  // Track current turn's text and tool calls (reset each turn)
  let turnTextParts: string[] = [];
  let turnToolCalls: { name: string; input: Record<string, unknown> }[] = [];
  const pendingTools = new Map<string, { name: string; input: Record<string, unknown> }>();
  const respondedEvents = new Set<string>(); // Track events we've already sent results for
  const allTextParts: string[] = [];

  // Open stream, then send message
  const stream = await client.beta.sessions.events.stream(sessionId);

  await client.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: "user.message",
        content: [{ type: "text", text: messageText }],
      },
    ],
  });

  for await (const event of stream) {
    switch (event.type) {
      case "agent.message":
        for (const block of (event as any).content || []) {
          if (block.type === "text") {
            turnTextParts.push(block.text);
            allTextParts.push(block.text);
          }
        }
        break;

      case "agent.custom_tool_use": {
        const te = event as any;
        const toolInfo = { name: te.name, input: te.input };
        pendingTools.set(event.id, toolInfo);
        turnToolCalls.push(toolInfo);

        // Extract work_order_id from tool calls that reference a work order
        if (WORK_ORDER_TOOLS.has(te.name) && te.input?.work_order_id) {
          currentWoId = te.input.work_order_id as string;
        }
        break;
      }

      case "session.status_idle": {
        const ie = event as any;
        const sr = ie.stop_reason;
        if (sr?.type === "requires_action") {
          // Log this turn's agent message + tool calls before executing tools
          const turnText = turnTextParts.join("\n").trim();
          if (turnText || turnToolCalls.length > 0) {
            await supabase.from("agent_conversation_log").insert({
              session_id: sessionId,
              contractor_id: contractorId,
              direction: "outbound",
              message: turnText || "[tool call]",
              tool_calls: turnToolCalls.length > 0 ? turnToolCalls : null,
              work_order_id: currentWoId,
            });
          }

          // Reset for next turn
          turnTextParts = [];
          turnToolCalls = [];

          // Execute tools and return results (skip already-responded events)
          const results: any[] = [];
          for (const eventId of sr.event_ids) {
            if (respondedEvents.has(eventId)) continue; // Already sent result for this event
            const tool = pendingTools.get(eventId);
            if (tool) {
              console.log(`[Agent] Tool call: ${tool.name}(${JSON.stringify(tool.input).slice(0, 100)})`);
              const result = await handleToolCall(tool.name, tool.input, contractorId);
              results.push({
                type: "user.custom_tool_result",
                custom_tool_use_id: eventId,
                content: [{ type: "text", text: JSON.stringify(result) }],
              });
            } else {
              // Unknown event — not a custom tool we registered. Log and skip.
              console.error(`[Agent] Unknown event_id in requires_action: ${eventId} (not in pendingTools). Skipping.`);
            }
            respondedEvents.add(eventId);
          }
          if (results.length > 0) {
            await client.beta.sessions.events.send(sessionId, { events: results });
          }
        } else if (sr?.type === "end_turn") {
          break;
        }
        break;
      }

      case "session.error":
        console.error("[Agent] Session error:", (event as any).error);
        break;
    }

    if ((event as any).stop_reason?.type === "end_turn") break;
  }

  // Log final turn (the end_turn response)
  // Only log if there's actual text content — skip empty end_turn after tool results
  // (e.g. save_memory returns → agent has nothing to say → empty end_turn)
  const finalText = turnTextParts.join("\n").trim();
  if (finalText) {
    await supabase.from("agent_conversation_log").insert({
      session_id: sessionId,
      contractor_id: contractorId,
      direction: "outbound",
      message: finalText,
      tool_calls: turnToolCalls.length > 0 ? turnToolCalls : null,
      work_order_id: currentWoId,
    });
  }

  const reply = allTextParts.join("\n").trim();
  console.log(`[Agent] Reply: ${reply.slice(0, 100)}...`);

  return reply;
}
