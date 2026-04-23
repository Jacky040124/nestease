import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getContractorId, unauthorizedResponse } from "@/lib/auth";
import { transitionWorkOrder, InvalidTransitionError } from "@/services/work-order-state-machine";
import { WorkOrderStatus, PMSettings } from "@/types";
import { processSideEffects } from "@/lib/side-effects-processor";

const ALLOWED_ACTIONS = ["contractor_start_quote"];

// POST /api/contractor/work-orders/[id]/transition — Contractor transitions via session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const contractorId = await getContractorId(request);
  if (!contractorId) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }
  if (!ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ error: `Action ${action} not allowed` }, { status: 403 });
  }

  const { data: workOrder, error: fetchError } = await supabaseAdmin
    .from("work_order").select("*").eq("id", id).eq("contractor_id", contractorId).single();

  if (fetchError || !workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  const { data: pm } = await supabaseAdmin
    .from("pm")
    .select("auto_approval_enabled, auto_approval_threshold, follow_up_wait_days, notification_channel")
    .eq("id", workOrder.pm_id).single();

  const pmSettings: PMSettings | undefined = pm
    ? { auto_approval_enabled: pm.auto_approval_enabled, auto_approval_threshold: Number(pm.auto_approval_threshold), follow_up_wait_days: pm.follow_up_wait_days, notification_channel: pm.notification_channel }
    : undefined;

  try {
    const result = transitionWorkOrder(
      workOrder.status as WorkOrderStatus, action,
      { workOrderId: id, pmSettings, heldFromStatus: workOrder.held_from_status as WorkOrderStatus | undefined }
    );

    const update: Record<string, unknown> = { status: result.newStatus };

    const effectUpdates = await processSideEffects(result.sideEffects, workOrder, {
      fallbackActorId: contractorId,
      pmSettings,
    });
    Object.assign(update, effectUpdates);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("work_order").update(update).eq("id", id).eq("status", workOrder.status).select().single();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Conflict: work order status was modified. Please retry." }, { status: 409 });
    }

    await supabaseAdmin.from("work_order_status_history").insert({
      work_order_id: id, from_status: workOrder.status, to_status: result.newStatus,
      action, actor_id: contractorId, actor_role: "contractor",
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof InvalidTransitionError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
