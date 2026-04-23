import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/auth/contractor/verify-code — Validate PM Code
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { code } = body;

  if (!code || typeof code !== "string" || code.trim() === "") {
    return NextResponse.json({ error: "PM Code 为必填项" }, { status: 422 });
  }

  const { data: pm } = await supabaseAdmin
    .from("pm")
    .select("name")
    .eq("pm_code", code.trim().toUpperCase())
    .single();

  if (!pm) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: true, pm_name: pm.name });
}
