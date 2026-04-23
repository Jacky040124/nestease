import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import { calculateCosts } from "@/lib/cost-calculator";
import {
  transitionWorkOrder,
  InvalidTransitionError,
} from "@/services/work-order-state-machine";
import { WorkOrderStatus, PMSettings, WorkType } from "@/types";
import { processSideEffects } from "@/lib/side-effects-processor";

// POST /api/work-orders/[id]/completion-report — Contractor submits completion report + auto-triggers transition
// Supports both PM session auth and internal API key auth (for agent service)
export async function POST(request: NextRequest, { params }: { params: Promise<Record<string, string>> }) {
  // Auth: internal API key OR PM session
  const internalKey = request.headers.get("x-internal-api-key");
  const expectedKey = process.env.NESTEASE_INTERNAL_API_KEY;
  const isInternalCall = expectedKey && internalKey === expectedKey;

  if (!isInternalCall) {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { id } = await params;
  const body = await request.json();

  const {
    contractor_id,
    work_type,
    work_description,
    actual_materials,
    actual_labor_hours,
    actual_labor_rate,
    actual_other_cost,
    completion_photos,
    recommendations,
  } = body;

  if (!contractor_id || !work_type || !work_description) {
    return NextResponse.json(
      { error: "contractor_id, work_type, and work_description are required" },
      { status: 400 }
    );
  }

  if (!Object.values(WorkType).includes(work_type)) {
    return NextResponse.json({ error: `Invalid work_type: ${work_type}` }, { status: 400 });
  }

  // Fetch work order + PM settings
  const { data: workOrder, error: fetchError } = await supabaseAdmin
    .from("work_order")
    .select("*, pm:pm_id(auto_approval_enabled, auto_approval_threshold, follow_up_wait_days, notification_channel)")
    .eq("id", id)
    .single();

  if (fetchError || !workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  if (workOrder.status !== "in_progress") {
    return NextResponse.json(
      { error: `Cannot submit completion report: work order is in ${workOrder.status} status` },
      { status: 422 }
    );
  }

  // Calculate actual costs
  const { laborCost: actualLaborCost, materialsCost: actualMaterialsCost, otherCost: actualOtherCost, total: actualTotal, materialsWithSubtotals } =
    calculateCosts(actual_labor_hours, actual_labor_rate, actual_materials, actual_other_cost);

  // Insert completion report
  const { data: report, error: reportError } = await supabaseAdmin
    .from("completion_report")
    .insert({
      work_order_id: id,
      contractor_id,
      work_type,
      work_description,
      actual_materials: materialsWithSubtotals,
      actual_materials_cost: actualMaterialsCost,
      actual_labor_hours: actual_labor_hours || 0,
      actual_labor_rate: actual_labor_rate || 0,
      actual_labor_cost: actualLaborCost,
      actual_other_cost: actualOtherCost,
      actual_total: actualTotal,
      completion_photos: completion_photos || [],
      recommendations: recommendations || null,
    })
    .select()
    .single();

  if (reportError) {
    return NextResponse.json({ error: reportError.message }, { status: 500 });
  }

  // Auto-trigger state transition: contractor_submit_completion
  const pm = workOrder.pm;
  const pmSettings: PMSettings | undefined = pm
    ? {
        auto_approval_enabled: pm.auto_approval_enabled,
        auto_approval_threshold: Number(pm.auto_approval_threshold),
        follow_up_wait_days: pm.follow_up_wait_days,
        notification_channel: pm.notification_channel,
      }
    : undefined;

  try {
    const result = transitionWorkOrder(
      workOrder.status as WorkOrderStatus,
      "contractor_submit_completion",
      { workOrderId: id, pmSettings }
    );

    // Build update
    const update: Record<string, unknown> = {
      status: result.newStatus,
      completion_report_id: report.id,
    };

    const effectUpdates = await processSideEffects(result.sideEffects, workOrder, {
      fallbackActorId: contractor_id,
      pmSettings,
    });
    Object.assign(update, effectUpdates);

    // Optimistic lock update
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("work_order")
      .update(update)
      .eq("id", id)
      .eq("status", workOrder.status)
      .select()
      .single();

    if (updateError || !updated) {
      // Report was saved but transition failed — delete orphan report
      await supabaseAdmin.from("completion_report").delete().eq("id", report.id);
      return NextResponse.json(
        { error: "Conflict: work order status changed. Completion report discarded, please retry." },
        { status: 409 }
      );
    }

    // Log status history
    await supabaseAdmin.from("work_order_status_history").insert({
      work_order_id: id,
      from_status: workOrder.status,
      to_status: result.newStatus,
      action: "contractor_submit_completion",
      actor_id: contractor_id,
      actor_role: "contractor",
    });

    return NextResponse.json({
      data: { completion_report: report, work_order: updated },
    }, { status: 201 });
  } catch (err) {
    // Transition failed — delete orphan report
    await supabaseAdmin.from("completion_report").delete().eq("id", report.id);
    if (err instanceof InvalidTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
