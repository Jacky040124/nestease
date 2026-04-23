import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getPublicAuth, publicUnauthorizedResponse } from "@/lib/public-auth";

// GET /api/public/work-orders/[id] — Read-only access via signed link
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getPublicAuth(request);
  if (!auth) return publicUnauthorizedResponse();

  const { id } = await params;

  // Verify the token is for this work order
  if (auth.workOrderId !== id) {
    return publicUnauthorizedResponse();
  }

  const { data: workOrder, error } = await supabaseAdmin
    .from("work_order")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  const [quoteRes, completionRes, historyRes] = await Promise.all([
    supabaseAdmin.from("quote").select("*").eq("work_order_id", id).order("submitted_at", { ascending: false }).limit(1),
    supabaseAdmin.from("completion_report").select("*").eq("work_order_id", id).order("submitted_at", { ascending: false }).limit(1),
    supabaseAdmin.from("work_order_status_history").select("*").eq("work_order_id", id).order("created_at", { ascending: true }),
  ]);

  return NextResponse.json({
    data: {
      ...workOrder,
      quote: quoteRes.data?.[0] || null,
      completion_report: completionRes.data?.[0] || null,
      status_history: historyRes.data || [],
    },
  });
}
