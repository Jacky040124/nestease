import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getPmId } from "@/lib/auth";

// POST /api/contractors — PM manually adds a contractor
export async function POST(request: NextRequest) {
  const pmId = await getPmId(request);
  if (!pmId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, phone, specialties } = body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "姓名为必填项" }, { status: 400 });
  }
  if (!phone || typeof phone !== "string" || phone.trim().length < 5) {
    return NextResponse.json({ error: "请输入有效的手机号" }, { status: 400 });
  }
  if (!specialties || !Array.isArray(specialties) || specialties.length === 0) {
    return NextResponse.json({ error: "请至少选择一个专长" }, { status: 400 });
  }

  // Check phone not already registered under this PM
  const { data: existing } = await supabaseAdmin
    .from("contractor")
    .select("id")
    .eq("phone", phone.trim())
    .eq("pm_id", pmId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "该手机号已在您的工人列表中" }, { status: 409 });
  }

  const { data: contractor, error } = await supabaseAdmin
    .from("contractor")
    .insert({
      name: name.trim(),
      phone: phone.trim(),
      specialties,
      pm_id: pmId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: contractor }, { status: 201 });
}

// GET /api/contractors — List contractors with aggregated stats
export async function GET(request: NextRequest) {
  const pmId = await getPmId(request);
  if (!pmId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all contractors for this PM
  const { data: contractors, error } = await supabaseAdmin
    .from("contractor")
    .select("*")
    .eq("pm_id", pmId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Show all contractors (including manually added ones without auth_id)
  let filtered = contractors || [];

  // Filter by specialty (JS-side since specialties is a JSON array)
  const { searchParams } = new URL(request.url);
  const specialty = searchParams.get("specialty");
  if (specialty) {
    filtered = filtered.filter(
      (c: { specialties?: string[] }) => c.specialties?.includes(specialty),
    );
  }

  const contractorIds = filtered.map((c: { id: string }) => c.id);

  // Fetch completed work orders, ratings, quotes, and completion reports for stats
  let workOrders: Record<string, unknown>[] = [];
  let ratings: Record<string, unknown>[] = [];
  let quotes: Record<string, unknown>[] = [];
  let completionReports: Record<string, unknown>[] = [];

  if (contractorIds.length > 0) {
    const [woRes, ratingRes, quoteRes, crRes] = await Promise.all([
      supabaseAdmin
        .from("work_order")
        .select("*")
        .in("contractor_id", contractorIds)
        .eq("status", "completed"),
      supabaseAdmin
        .from("contractor_rating")
        .select("*")
        .in("contractor_id", contractorIds),
      supabaseAdmin
        .from("quote")
        .select("*")
        .in("contractor_id", contractorIds),
      supabaseAdmin
        .from("completion_report")
        .select("*")
        .in("contractor_id", contractorIds),
    ]);
    workOrders = (woRes.data as Record<string, unknown>[]) || [];
    ratings = (ratingRes.data as Record<string, unknown>[]) || [];
    quotes = (quoteRes.data as Record<string, unknown>[]) || [];
    completionReports = (crRes.data as Record<string, unknown>[]) || [];
  }

  // Build stats and attach to each contractor
  const result = filtered.map((contractor: Record<string, unknown>) => {
    const cWorkOrders = workOrders.filter(
      (wo) => wo.contractor_id === contractor.id,
    );
    const cRatings = ratings.filter(
      (r) => r.contractor_id === contractor.id,
    );
    const cQuotes = quotes.filter(
      (q) => q.contractor_id === contractor.id,
    );
    const cReports = completionReports.filter(
      (cr) => cr.contractor_id === contractor.id,
    );

    const avgRating =
      cRatings.length > 0
        ? cRatings.reduce((sum, r) => sum + (r.rating as number), 0) /
          cRatings.length
        : null;

    const avgQuote =
      cQuotes.length > 0
        ? cQuotes.reduce((sum, q) => sum + (q.total as number), 0) /
          cQuotes.length
        : null;

    // avg_completion_days: completion_report.submitted_at - work_order.assigned_at
    const completionDays: number[] = [];
    for (const wo of cWorkOrders) {
      if (!wo.assigned_at) continue;
      const cr = cReports.find((r) => r.work_order_id === wo.id);
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
            (completionDays.reduce((a, b) => a + b, 0) /
              completionDays.length) *
              10,
          ) / 10
        : null;

    // rework_rate: work orders with parent_work_order_id / total completed
    const reworkCount = cWorkOrders.filter(
      (wo) => wo.parent_work_order_id,
    ).length;
    const reworkRate =
      cWorkOrders.length > 0 ? reworkCount / cWorkOrders.length : 0;

    // quote_variance: avg(|actual_total - quote.total| / quote.total)
    const variances: number[] = [];
    for (const cr of cReports) {
      const q = cQuotes.find((quote) => quote.work_order_id === cr.work_order_id);
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

    // Find most recent completed work order
    const sorted = [...cWorkOrders].sort(
      (a, b) =>
        new Date(b.completed_at as string).getTime() -
        new Date(a.completed_at as string).getTime(),
    );
    const recentWo = sorted[0] || null;

    return {
      ...contractor,
      stats: {
        total_completed: cWorkOrders.length,
        avg_rating: avgRating,
        avg_quote: avgQuote,
        avg_completion_days: avgCompletionDays,
        rework_rate: reworkRate,
        quote_variance: quoteVariance,
      },
      recent_work_order: recentWo
        ? {
            id: recentWo.id,
            property_address: recentWo.property_address,
            category: recentWo.category,
            completed_at: recentWo.completed_at,
          }
        : null,
    };
  });

  // Sort: favorites first
  result.sort((a, b) => {
    const aFav = (a as Record<string, unknown>).is_favorite ? 1 : 0;
    const bFav = (b as Record<string, unknown>).is_favorite ? 1 : 0;
    return bFav - aFav;
  });

  return NextResponse.json({ data: result });
}
