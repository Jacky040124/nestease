import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { withAuthParams } from "@/lib/with-auth";
import { generateToken } from "@/lib/token";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nestease-weld.vercel.app";

// POST /api/work-orders/[id]/send-archive — Generate completion report PDF URL for PM to download
export const POST = withAuthParams(async (_user, _request, { params }) => {
  const { id } = await params;

  const { data: wo } = await supabaseAdmin
    .from("work_order").select("*").eq("id", id).single();

  if (!wo) return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  if (wo.status !== "completed") {
    return NextResponse.json({ error: "Work order is not completed" }, { status: 422 });
  }

  const { data: owner } = await supabaseAdmin
    .from("owner").select("id").eq("id", wo.owner_id).single();

  if (!owner) return NextResponse.json({ error: "Owner not found" }, { status: 404 });

  const token = generateToken({ workOrderId: id, role: "owner", actorId: owner.id });
  const pdfUrl = `${BASE_URL}/api/work-orders/${id}/pdf?type=completion&token=${encodeURIComponent(token)}`;

  return NextResponse.json({ success: true, pdf_url: pdfUrl });
});
