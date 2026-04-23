import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import { getPublicAuth } from "@/lib/public-auth";
import { buildApprovalHTML, buildCompletionHTML, StatusHistoryEntry } from "@/lib/pdf-templates";

// GET /api/work-orders/[id]/pdf?type=approval|completion
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Accept either logged-in user auth OR a signed token (for email links)
  const user = await getAuthUser(request);
  const publicAuth = !user ? getPublicAuth(request) : null;
  if (!user && !publicAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const type = request.nextUrl.searchParams.get("type") || "approval";

  // Fetch work order
  const { data: wo } = await supabaseAdmin
    .from("work_order").select("*").eq("id", id).single();
  if (!wo) return NextResponse.json({ error: "Work order not found" }, { status: 404 });

  // Fetch related entities
  const [contractorRes, ownerRes, historyRes] = await Promise.all([
    wo.contractor_id
      ? supabaseAdmin.from("contractor").select("name, phone, email, specialties").eq("id", wo.contractor_id).single()
      : Promise.resolve({ data: null }),
    wo.owner_id
      ? supabaseAdmin.from("owner").select("name, phone, email").eq("id", wo.owner_id).single()
      : Promise.resolve({ data: null }),
    supabaseAdmin.from("work_order_status_history")
      .select("action, from_status, to_status, actor_role, created_at")
      .eq("work_order_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const contractor = contractorRes.data;
  const owner = ownerRes.data;
  const history = (historyRes.data || []) as StatusHistoryEntry[];

  if (type === "approval") {
    const { data: quote } = await supabaseAdmin
      .from("quote").select("*").eq("work_order_id", id)
      .order("submitted_at", { ascending: false }).limit(1).single();
    if (!quote) return NextResponse.json({ error: "No quote found" }, { status: 404 });

    const html = buildApprovalHTML(wo, quote, contractor, owner, history);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (type === "completion") {
    const { data: quote } = await supabaseAdmin
      .from("quote").select("*").eq("work_order_id", id).limit(1).single();
    const { data: report } = await supabaseAdmin
      .from("completion_report").select("*").eq("work_order_id", id).limit(1).single();
    if (!report) return NextResponse.json({ error: "No completion report found" }, { status: 404 });

    const html = buildCompletionHTML(wo, quote, report, contractor, owner, history);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.json({ error: "Invalid type. Use 'approval' or 'completion'" }, { status: 400 });
}
