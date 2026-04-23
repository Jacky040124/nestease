import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getPmId } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/contractors/[id]/rate — Rate a contractor for a completed work order
export async function POST(request: NextRequest, ctx: RouteContext) {
  const pmId = await getPmId(request);
  if (!pmId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: contractorId } = await ctx.params;
  const body = await request.json();
  const { work_order_id, rating, comment } = body;

  // Validate rating range
  if (typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be between 1 and 5" },
      { status: 422 },
    );
  }

  // Check work order exists
  const { data: workOrder, error: woError } = await supabaseAdmin
    .from("work_order")
    .select("*")
    .eq("id", work_order_id)
    .single();

  if (woError || !workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  // Check work order belongs to current PM
  if (workOrder.pm_id !== pmId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check contractor matches work order
  if (workOrder.contractor_id !== contractorId) {
    return NextResponse.json(
      { error: "Contractor does not match work order" },
      { status: 422 },
    );
  }

  // Check for duplicate rating
  const { data: existingRatings } = await supabaseAdmin
    .from("contractor_rating")
    .select("*")
    .eq("work_order_id", work_order_id);

  if (existingRatings && existingRatings.length > 0) {
    return NextResponse.json(
      { error: "Rating already exists for this work order" },
      { status: 409 },
    );
  }

  // Create rating
  const { data: newRating, error } = await supabaseAdmin
    .from("contractor_rating")
    .insert({
      work_order_id,
      contractor_id: contractorId,
      pm_id: pmId,
      rating,
      comment: comment || null,
    })
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: newRating }, { status: 201 });
}
