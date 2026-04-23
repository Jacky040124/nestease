import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getPmId } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/contractors/[id]/notes — List notes (newest first)
export async function GET(request: NextRequest, ctx: RouteContext) {
  const pmId = await getPmId(request);
  if (!pmId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: contractorId } = await ctx.params;

  // Verify contractor ownership
  const { data: contractor, error: lookupError } = await supabaseAdmin
    .from("contractor")
    .select("*")
    .eq("id", contractorId)
    .single();

  if (lookupError || !contractor) {
    return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
  }

  if (contractor.pm_id !== pmId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: notes, error } = await supabaseAdmin
    .from("contractor_note")
    .select("*")
    .eq("contractor_id", contractorId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: notes });
}

// POST /api/contractors/[id]/notes — Create a note
export async function POST(request: NextRequest, ctx: RouteContext) {
  const pmId = await getPmId(request);
  if (!pmId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: contractorId } = await ctx.params;

  // Verify contractor ownership
  const { data: contractor, error: lookupError } = await supabaseAdmin
    .from("contractor")
    .select("*")
    .eq("id", contractorId)
    .single();

  if (lookupError || !contractor) {
    return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
  }

  if (contractor.pm_id !== pmId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { content } = body;

  if (!content || content.trim() === "") {
    return NextResponse.json(
      { error: "Content is required" },
      { status: 422 },
    );
  }

  const { data: note, error } = await supabaseAdmin
    .from("contractor_note")
    .insert({
      contractor_id: contractorId,
      pm_id: pmId,
      content,
    })
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: note }, { status: 201 });
}
