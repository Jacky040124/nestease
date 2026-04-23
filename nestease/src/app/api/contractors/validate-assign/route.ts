import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getPmId } from "@/lib/auth";

// POST /api/contractors/validate-assign — Check if contractor is registered (can be assigned)
export async function POST(request: NextRequest) {
  const pmId = await getPmId(request);
  if (!pmId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { contractor_id } = body;

  if (!contractor_id) {
    return NextResponse.json({ error: "contractor_id 为必填项" }, { status: 400 });
  }

  const { data: contractor } = await supabaseAdmin
    .from("contractor")
    .select("id, auth_id, name")
    .eq("id", contractor_id)
    .eq("pm_id", pmId)
    .single();

  if (!contractor) {
    return NextResponse.json({ error: "工人不存在" }, { status: 404 });
  }

  if (!contractor.auth_id) {
    return NextResponse.json(
      { error: "该工人尚未注册，请先邀请注册后再指派" },
      { status: 422 }
    );
  }

  return NextResponse.json({ valid: true, contractor_name: contractor.name });
}
