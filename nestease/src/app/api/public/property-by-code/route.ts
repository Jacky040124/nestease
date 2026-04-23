import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/public/property-by-code?code=A3K7P2 — lookup property by repair code (no auth)
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Missing required parameter: code" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("property")
    .select("id, address, unit, pm_id")
    .eq("repair_code", code)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
