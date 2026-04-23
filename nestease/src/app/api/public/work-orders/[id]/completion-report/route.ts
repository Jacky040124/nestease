import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getPublicAuth, publicUnauthorizedResponse } from "@/lib/public-auth";
import { calculateCosts } from "@/lib/cost-calculator";
import { transitionWorkOrder, InvalidTransitionError } from "@/services/work-order-state-machine";
import { WorkOrderStatus, PMSettings, WorkType } from "@/types";
import { processSideEffects } from "@/lib/side-effects-processor";

// POST /api/public/work-orders/[id]/completion-report — Contractor submits via signed link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getPublicAuth(request);
  if (!auth || auth.role !== "contractor") return publicUnauthorizedResponse();

  const { id } = await params;
  if (auth.workOrderId !== id) return publicUnauthorizedResponse();

  const body = await request.json();
  const { work_type, work_description, actual_materials, actual_labor_hours, actual_labor_rate, actual_other_cost, completion_photos, recommendations } = body;

  if (!work_type || !work_description) {
    return NextResponse.json({ error: "work_type and work_description are required" }, { status: 400 });
  }
  if (!Object.values(WorkType).includes(work_type)) {
    return NextResponse.json({ error: `Invalid work_type: ${work_type}` }, { status: 400 });
  }

  const { data: workOrder, error: fetchError } = await supabaseAdmin
    .from("work_order")
    .select("*, pm:pm_id(auto_approval_enabled, auto_approval_threshold, follow_up_wait_days, notification_channel)")
    .eq("id", id).single();

  if (fetchError || !workOrder) return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  if (workOrder.status !== "in_progress") {
    return NextResponse.json({ error: `Cannot submit completion report: work order is in ${workOrder.status} status` }, { status: 422 });
  }

  const { laborCost: actualLaborCost, materialsCost: actualMaterialsCost, otherCost: actualOtherCost, total: actualTotal, materialsWithSubtotals } =
    calculateCosts(actual_labor_hours, actual_labor_rate, actual_materials, actual_other_cost);

  const { data: report, error: reportError } = await supabaseAdmin.from("completion_report").insert({
    work_order_id: id, contractor_id: workOrder.contractor_id, work_type, work_description,
    actual_materials: materialsWithSubtotals, actual_materials_cost: actualMaterialsCost,
    actual_labor_hours: actual_labor_hours || 0, actual_labor_rate: actual_labor_rate || 0,
    actual_labor_cost: actualLaborCost, actual_other_cost: actualOtherCost, actual_total: actualTotal,
    completion_photos: completion_photos || [], recommendations: recommendations || null,
  }).select().single();

  if (reportError) return NextResponse.json({ error: reportError.message }, { status: 500 });

  const pm = workOrder.pm;
  const pmSettings: PMSettings | undefined = pm
    ? { auto_approval_enabled: pm.auto_approval_enabled, auto_approval_threshold: Number(pm.auto_approval_threshold), follow_up_wait_days: pm.follow_up_wait_days, notification_channel: pm.notification_channel }
    : undefined;

  try {
    const result = transitionWorkOrder(workOrder.status as WorkOrderStatus, "contractor_submit_completion", { workOrderId: id, pmSettings });
    const update: Record<string, unknown> = { status: result.newStatus, completion_report_id: report.id };

    const effectUpdates = await processSideEffects(result.sideEffects, workOrder, {
      fallbackActorId: auth.actorId,
      pmSettings,
    });
    Object.assign(update, effectUpdates);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("work_order").update(update).eq("id", id).eq("status", workOrder.status).select().single();

    if (updateError || !updated) {
      await supabaseAdmin.from("completion_report").delete().eq("id", report.id);
      return NextResponse.json({ error: "Conflict: work order status changed. Report discarded, please retry." }, { status: 409 });
    }

    await supabaseAdmin.from("work_order_status_history").insert({
      work_order_id: id, from_status: workOrder.status, to_status: result.newStatus,
      action: "contractor_submit_completion", actor_id: auth.actorId, actor_role: "contractor",
    });

    return NextResponse.json({ data: { completion_report: report, work_order: updated } }, { status: 201 });
  } catch (err) {
    await supabaseAdmin.from("completion_report").delete().eq("id", report.id);
    if (err instanceof InvalidTransitionError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
