import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getContractorId, unauthorizedResponse } from "@/lib/auth";

// GET /api/contractor/work-orders/[id] — Contractor reads work order details via session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const contractorId = await getContractorId(request);
  if (!contractorId) return unauthorizedResponse();

  const { id } = await params;

  const { data: workOrder, error } = await supabaseAdmin
    .from("work_order")
    .select("*")
    .eq("id", id)
    .eq("contractor_id", contractorId)
    .single();

  if (error || !workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  const [quoteRes, completionRes] = await Promise.all([
    supabaseAdmin.from("quote").select("*").eq("work_order_id", id).order("submitted_at", { ascending: false }).limit(1),
    supabaseAdmin.from("completion_report").select("*").eq("work_order_id", id).order("submitted_at", { ascending: false }).limit(1),
  ]);

  return NextResponse.json({
    data: {
      ...workOrder,
      quote: quoteRes.data?.[0] || null,
      completion_report: completionRes.data?.[0] || null,
    },
  });
}
