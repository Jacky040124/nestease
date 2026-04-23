import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getPmId } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

// PATCH /api/contractors/[id]/notes/[noteId] — Update a note
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const pmId = await getPmId(request);
  if (!pmId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: contractorId, noteId } = await ctx.params;

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

  // Verify note exists and belongs to this contractor
  const { data: note, error: noteError } = await supabaseAdmin
    .from("contractor_note")
    .select("*")
    .eq("id", noteId)
    .single();

  if (noteError || !note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  if (note.contractor_id !== contractorId) {
    return NextResponse.json({ error: "Note does not belong to this contractor" }, { status: 422 });
  }

  const body = await request.json();
  const { content } = body;

  if (!content || content.trim() === "") {
    return NextResponse.json(
      { error: "Content is required" },
      { status: 422 },
    );
  }

  const { data: updated, error } = await supabaseAdmin
    .from("contractor_note")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", noteId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: updated });
}

// DELETE /api/contractors/[id]/notes/[noteId] — Delete a note
export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const pmId = await getPmId(request);
  if (!pmId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: contractorId, noteId } = await ctx.params;

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

  // Verify note exists and belongs to this contractor
  const { data: note, error: noteError } = await supabaseAdmin
    .from("contractor_note")
    .select("*")
    .eq("id", noteId)
    .single();

  if (noteError || !note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  if (note.contractor_id !== contractorId) {
    return NextResponse.json({ error: "Note does not belong to this contractor" }, { status: 422 });
  }

  await supabaseAdmin
    .from("contractor_note")
    .delete()
    .eq("id", noteId);

  return NextResponse.json({ data: { success: true } });
}
