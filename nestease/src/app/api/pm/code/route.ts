import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getPmId } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nestease-weld.vercel.app";

// GET /api/pm/code — Get current PM's registration code
export async function GET(request: NextRequest) {
  const pmId = await getPmId(request);
  if (!pmId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: pm, error } = await supabaseAdmin
    .from("pm")
    .select("pm_code")
    .eq("id", pmId)
    .single();

  if (error || !pm) {
    return NextResponse.json({ error: "PM not found" }, { status: 404 });
  }

  return NextResponse.json({
    code: pm.pm_code,
    share_url: `${BASE_URL}/register/contractor?code=${pm.pm_code}`,
  });
}
