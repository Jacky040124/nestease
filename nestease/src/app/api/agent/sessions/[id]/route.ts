import { NextRequest, NextResponse } from "next/server";
import { getPmId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const pmId = await getPmId(request);
  if (!pmId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await params;

  // Get session info
  const { data: session } = await supabaseAdmin
    .from("agent_sessions")
    .select("contractor_id, pm_id, status, confirmed, created_at")
    .eq("session_id", sessionId)
    .eq("pm_id", pmId)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Optional work_order_id filter
  const url = new URL(request.url);
  const workOrderFilter = url.searchParams.get("work_order_id");

  // Batch queries
  let msgsQuery = supabaseAdmin
    .from("agent_conversation_log")
    .select("id, direction, message, tool_calls, work_order_id, created_at")
    .eq("session_id", sessionId);

  // When filtering by work order, include all messages within the time range
  // of that work order's conversation (so contractor messages without work_order_id are included)
  if (workOrderFilter) {
    const { data: woMsgs } = await supabaseAdmin
      .from("agent_conversation_log")
      .select("created_at")
      .eq("session_id", sessionId)
      .eq("work_order_id", workOrderFilter)
      .order("created_at", { ascending: true });

    if (woMsgs && woMsgs.length > 0) {
      const earliest = woMsgs[0].created_at;
      const latest = woMsgs[woMsgs.length - 1].created_at;
      msgsQuery = msgsQuery.gte("created_at", earliest).lte("created_at", latest);
    } else {
      msgsQuery = msgsQuery.eq("work_order_id", workOrderFilter);
    }
  }

  const [msgsRes, contractorRes, memoriesRes, workOrdersRes] = await Promise.all([
    msgsQuery.order("created_at", { ascending: true }),
    supabaseAdmin
      .from("contractor")
      .select("name, phone")
      .eq("id", session.contractor_id)
      .single(),
    supabaseAdmin
      .from("agent_memories")
      .select("key, content")
      .eq("contractor_id", session.contractor_id)
      .eq("pm_id", session.pm_id),
    supabaseAdmin
      .from("work_order")
      .select("id, status, property_address, unit, description")
      .eq("pm_id", pmId)
      .eq("contractor_id", session.contractor_id)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    data: {
      session: {
        status: session.status,
        confirmed: session.confirmed ?? false,
        created_at: session.created_at,
      },
      contractor: contractorRes.data || null,
      messages: msgsRes.data || [],
      memories: memoriesRes.data || [],
      work_orders: (workOrdersRes.data || []).map((w) => ({
        id: w.id,
        status: w.status,
        address: w.unit ? `${w.property_address} Unit ${w.unit}` : w.property_address,
        description: w.description,
      })),
    },
  });
}
