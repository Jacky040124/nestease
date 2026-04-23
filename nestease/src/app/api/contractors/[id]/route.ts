import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getPmId } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/contractors/[id] — Contractor detail with stats and work orders
export async function GET(request: NextRequest, ctx: RouteContext) {
  const pmId = await getPmId(request);
  if (!pmId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const { data: contractor, error } = await supabaseAdmin
    .from("contractor")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !contractor) {
    return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
  }

  if (contractor.pm_id !== pmId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch work orders, ratings, quotes, completion reports, notes in parallel
  const [woRes, ratingRes, quoteRes, crRes, noteRes] = await Promise.all([
    supabaseAdmin
      .from("work_order")
      .select("*")
      .eq("contractor_id", id),
    supabaseAdmin
      .from("contractor_rating")
      .select("*")
      .eq("contractor_id", id),
    supabaseAdmin
      .from("quote")
      .select("*")
      .eq("contractor_id", id),
    supabaseAdmin
      .from("completion_report")
      .select("*")
      .eq("contractor_id", id),
    supabaseAdmin
      .from("contractor_note")
      .select("*")
      .eq("contractor_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const workOrders = (woRes.data as Record<string, unknown>[]) || [];
  const ratings = (ratingRes.data as Record<string, unknown>[]) || [];
  const quotes = (quoteRes.data as Record<string, unknown>[]) || [];
  const reports = (crRes.data as Record<string, unknown>[]) || [];
  const notes = (noteRes.data as Record<string, unknown>[]) || [];
  const completed = workOrders.filter((wo) => wo.status === "completed");

  const avgRating =
    ratings.length > 0
      ? ratings.reduce((sum, r) => sum + (r.rating as number), 0) / ratings.length
      : null;

  const avgQuote =
    quotes.length > 0
      ? quotes.reduce((sum, q) => sum + (q.total as number), 0) / quotes.length
      : null;

  const completionDays: number[] = [];
  for (const wo of completed) {
    if (!wo.assigned_at) continue;
    const cr = reports.find((r) => r.work_order_id === wo.id);
    if (cr?.submitted_at) {
      const days =
        (new Date(cr.submitted_at as string).getTime() -
          new Date(wo.assigned_at as string).getTime()) /
        (1000 * 60 * 60 * 24);
      completionDays.push(days);
    }
  }
  const avgCompletionDays =
    completionDays.length > 0
      ? Math.round(
          (completionDays.reduce((a, b) => a + b, 0) / completionDays.length) * 10,
        ) / 10
      : null;

  const reworkCount = completed.filter((wo) => wo.parent_work_order_id).length;
  const reworkRate = completed.length > 0 ? reworkCount / completed.length : 0;

  const variances: number[] = [];
  for (const cr of reports) {
    const q = quotes.find((quote) => quote.work_order_id === cr.work_order_id);
    if (q && (q.total as number) > 0) {
      variances.push(
        Math.abs((cr.actual_total as number) - (q.total as number)) /
          (q.total as number),
      );
    }
  }
  const quoteVariance =
    variances.length > 0
      ? Math.round(
          (variances.reduce((a, b) => a + b, 0) / variances.length) * 100,
        ) / 100
      : null;

  return NextResponse.json({
    data: {
      ...contractor,
      stats: {
        total_completed: completed.length,
        avg_rating: avgRating,
        avg_quote: avgQuote,
        avg_completion_days: avgCompletionDays,
        rework_rate: reworkRate,
        quote_variance: quoteVariance,
      },
      work_orders: workOrders,
      ratings,
      notes,
    },
  });
}

// PATCH /api/contractors/[id] — Update contractor info
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const pmId = await getPmId(request);
  if (!pmId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  // Verify ownership
  const { data: contractor, error: lookupError } = await supabaseAdmin
    .from("contractor")
    .select("*")
    .eq("id", id)
    .single();

  if (lookupError || !contractor) {
    return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
  }

  if (contractor.pm_id !== pmId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  // Only allow updating specific fields
  const allowedFields = ["name", "phone", "email", "specialties", "is_favorite"];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  const { data: updated, error } = await supabaseAdmin
    .from("contractor")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: updated });
}
