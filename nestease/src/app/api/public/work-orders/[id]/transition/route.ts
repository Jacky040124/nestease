import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getPublicAuth, publicUnauthorizedResponse } from "@/lib/public-auth";
import { transitionWorkOrder, InvalidTransitionError } from "@/services/work-order-state-machine";
import { WorkOrderStatus, PMSettings } from "@/types";
import { processSideEffects } from "@/lib/side-effects-processor";

// Allowed actions for each external role
const ROLE_ACTIONS: Record<string, string[]> = {
  contractor: ["contractor_start_quote"],
  owner: ["owner_approve", "owner_reject"],
  tenant: ["tenant_confirm", "tenant_report_issue"],
};

// POST /api/public/work-orders/[id]/transition — External role transitions via signed link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getPublicAuth(request);
  if (!auth) return publicUnauthorizedResponse();

  const { id } = await params;
  if (auth.workOrderId !== id) return publicUnauthorizedResponse();

  const body = await request.json();
  const { action } = body;

  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  // Verify the role is allowed to perform this action
  const allowed = ROLE_ACTIONS[auth.role];
  if (!allowed || !allowed.includes(action)) {
    return NextResponse.json({ error: `Action ${action} not allowed for role ${auth.role}` }, { status: 403 });
  }

  const { data: workOrder, error: fetchError } = await supabaseAdmin
    .from("work_order").select("*").eq("id", id).single();

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
      fallbackActorId: auth.actorId,
      pmSettings,
    });
    Object.assign(update, effectUpdates);

    // Action-specific updates
    if (result.newStatus === WorkOrderStatus.Completed) {
      update.completed_at = new Date().toISOString();
      if (action === "tenant_confirm") update.follow_up_status = "confirmed";
      else if (action === "tenant_report_issue") update.follow_up_status = "has_issue";
    }
    if (action === "owner_approve") {
      update.approval_status = "approved"; update.approved_by = auth.actorId; update.approved_at = new Date().toISOString();
    }
    if (action === "owner_reject") {
      update.approval_status = "rejected"; update.approved_by = auth.actorId; update.approved_at = new Date().toISOString();
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("work_order").update(update).eq("id", id).eq("status", workOrder.status).select().single();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Conflict: work order status was modified. Please retry." }, { status: 409 });
    }

    await supabaseAdmin.from("work_order_status_history").insert({
      work_order_id: id, from_status: workOrder.status, to_status: result.newStatus,
      action, actor_id: auth.actorId, actor_role: auth.role,
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof InvalidTransitionError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
