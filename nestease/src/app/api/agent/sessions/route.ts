import { NextRequest, NextResponse } from "next/server";
import { getPmId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const pmId = await getPmId(request);
  if (!pmId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional contractor filter (used by work-order-detail "查看龙虾对话")
  const url = new URL(request.url);
  const contractorId = url.searchParams.get("contractor_id");

  // Get agent sessions for this PM
  let query = supabaseAdmin
    .from("agent_sessions")
    .select("id, session_id, contractor_id, status, confirmed, created_at")
    .eq("pm_id", pmId);

  if (contractorId) {
    query = query.eq("contractor_id", contractorId);
  }

  const { data: sessions } = await query.order("created_at", { ascending: false });

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const contractorIds = [...new Set(sessions.map((s) => s.contractor_id))];
  const sessionIds = sessions.map((s) => s.session_id);

  // Batch queries
  const [contractorsRes, recentMsgsRes, activeWosRes, toolCallsRes] = await Promise.all([
    supabaseAdmin
      .from("contractor")
      .select("id, name, phone")
      .in("id", contractorIds),
    supabaseAdmin
      .from("agent_conversation_log")
      .select("session_id, message, direction, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("work_order")
      .select("id, contractor_id, property_address, unit, description, status")
      .eq("pm_id", pmId)
      .in("contractor_id", contractorIds)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("agent_conversation_log")
      .select("session_id, tool_calls")
      .in("session_id", sessionIds)
      .not("tool_calls", "is", null),
  ]);

  const contractorMap = new Map(
    (contractorsRes.data || []).map((c) => [c.id, { name: c.name, phone: c.phone }])
  );

  // Last message per session
  const lastMsgMap = new Map<string, { message: string; direction: string; created_at: string }>();
  for (const msg of recentMsgsRes.data || []) {
    if (!lastMsgMap.has(msg.session_id)) {
      lastMsgMap.set(msg.session_id, msg);
    }
  }

  // Work orders per contractor (active count + first work order for display)
  const woActiveCountMap = new Map<string, number>();
  const woTotalCountMap = new Map<string, number>();
  const woDetailMap = new Map<string, { address: string; description: string }>();
  for (const wo of activeWosRes.data || []) {
    woTotalCountMap.set(wo.contractor_id, (woTotalCountMap.get(wo.contractor_id) || 0) + 1);
    if (!["completed", "cancelled"].includes(wo.status)) {
      woActiveCountMap.set(wo.contractor_id, (woActiveCountMap.get(wo.contractor_id) || 0) + 1);
    }
    // Keep first (most recent) work order per contractor for display
    if (!woDetailMap.has(wo.contractor_id)) {
      const address = wo.unit ? `${wo.property_address} Unit ${wo.unit}` : wo.property_address;
      woDetailMap.set(wo.contractor_id, { address, description: wo.description });
    }
  }

  // Escalation detection
  const escalationSet = new Set<string>();
  for (const e of toolCallsRes.data || []) {
    if (
      Array.isArray(e.tool_calls) &&
      e.tool_calls.some((tc: { name: string }) => tc.name === "notify_pm")
    ) {
      escalationSet.add(e.session_id);
    }
  }

  // Clean message prefixes
  function cleanPreview(msg: string, direction: string): string {
    if (direction === "inbound") {
      return msg
        .replace(/^\[当前时间:.*?\]\n/m, "")
        .replace(/^\[师傅:.*?\]\n/m, "")
        .replace(/^\[首次接触.*?\]\n/m, "")
        .replace(/^\[该师傅的历史记忆\][\s\S]*?\n\n/m, "")
        .trim();
    }
    return msg;
  }

  const rows = sessions.map((s) => {
    const contractor = contractorMap.get(s.contractor_id);
    const lastMsg = lastMsgMap.get(s.session_id);

    return {
      id: s.id,
      session_id: s.session_id,
      contractor_id: s.contractor_id,
      status: s.status,
      confirmed: s.confirmed ?? false,
      created_at: s.created_at,
      contractor_name: contractor?.name || "未知",
      contractor_phone: contractor?.phone || "",
      last_message: lastMsg ? cleanPreview(lastMsg.message, lastMsg.direction) : null,
      last_message_direction: lastMsg?.direction || null,
      last_message_at: lastMsg?.created_at || null,
      active_work_orders: woActiveCountMap.get(s.contractor_id) || 0,
      total_work_orders: woTotalCountMap.get(s.contractor_id) || 0,
      work_order_summary: woDetailMap.get(s.contractor_id) || null,
      has_escalation: escalationSet.has(s.session_id),
    };
  });

  // Sort by last message time
  rows.sort((a, b) => {
    const ta = a.last_message_at || a.created_at;
    const tb = b.last_message_at || b.created_at;
    return new Date(tb).getTime() - new Date(ta).getTime();
  });

  return NextResponse.json({ data: rows });
}
