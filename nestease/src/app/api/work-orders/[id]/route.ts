import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { withAuthParams } from "@/lib/with-auth";

// GET /api/work-orders/[id] — Get a single work order with related data
export const GET = withAuthParams(async (_user, request, { params }) => {
  const { id } = await params;

  const { data: workOrder, error } = await supabaseAdmin
    .from("work_order")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  // Fetch related data in parallel
  const [quoteRes, completionRes, historyRes] = await Promise.all([
    supabaseAdmin
      .from("quote")
      .select("*")
      .eq("work_order_id", id)
      .order("submitted_at", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("completion_report")
      .select("*")
      .eq("work_order_id", id)
      .order("submitted_at", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("work_order_status_history")
      .select("*")
      .eq("work_order_id", id)
      .order("created_at", { ascending: true }),
  ]);

  return NextResponse.json({
    data: {
      ...workOrder,
      quote: quoteRes.data?.[0] || null,
      completion_report: completionRes.data?.[0] || null,
      status_history: historyRes.data || [],
    },
  });
});
