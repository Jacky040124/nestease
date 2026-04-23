import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { withAuthParams } from "@/lib/with-auth";
import {
  transitionWorkOrder,
  InvalidTransitionError,
} from "@/services/work-order-state-machine";
import { WorkOrderStatus, PMSettings } from "@/types";
import { processSideEffects } from "@/lib/side-effects-processor";

// POST /api/work-orders/[id]/transition — Transition work order status
export const POST = withAuthParams(async (_user, request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const { action, actor_id, actor_role, quote_amount, hold_reason } = body;

  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  // Fetch current work order
  const { data: workOrder, error: fetchError } = await supabaseAdmin
    .from("work_order")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  // Fetch PM settings
  const { data: pm } = await supabaseAdmin
    .from("pm")
    .select("auto_approval_enabled, auto_approval_threshold, follow_up_wait_days, notification_channel")
    .eq("id", workOrder.pm_id)
    .single();

  const pmSettings: PMSettings | undefined = pm
    ? {
        auto_approval_enabled: pm.auto_approval_enabled,
        auto_approval_threshold: Number(pm.auto_approval_threshold),
        follow_up_wait_days: pm.follow_up_wait_days,
        notification_channel: pm.notification_channel,
      }
    : undefined;

  // Execute state transition
  try {
    const result = transitionWorkOrder(
      workOrder.status as WorkOrderStatus,
      action,
      {
        workOrderId: id,
        pmSettings,
        quoteAmount: quote_amount,
        holdReason: hold_reason,
        heldFromStatus: workOrder.held_from_status as WorkOrderStatus | undefined,
      }
    );

    // Build update payload
    const update: Record<string, unknown> = {
      status: result.newStatus,
    };

    // Fetch quote amount if not provided (e.g., PM approving from dashboard)
    let amount = quote_amount;
    if (!amount && workOrder.quote_id) {
      const { data: quote } = await supabaseAdmin
        .from("quote").select("total").eq("id", workOrder.quote_id).single();
      amount = quote?.total;
    }

    // Process side effects
    const effectUpdates = await processSideEffects(result.sideEffects, workOrder, {
      fallbackActorId: actor_id,
      extraContractorId: body.contractor_id,
      amount,
      pmSettings,
    });
    Object.assign(update, effectUpdates);

    // Handle specific action updates
    if (action === "pm_assign_contractor" && body.contractor_id) {
      update.contractor_id = body.contractor_id;
      update.assigned_at = new Date().toISOString();
    }
    if (result.newStatus === WorkOrderStatus.Completed) {
      update.completed_at = new Date().toISOString();
      if (action === "tenant_confirm") {
        update.follow_up_status = "confirmed";
      } else if (action === "auto_timeout") {
        update.follow_up_status = "auto_completed";
      } else if (action === "tenant_report_issue") {
        update.follow_up_status = "has_issue";
      }
    }
    if (action === "owner_approve") {
      update.approval_status = "approved";
      update.approved_by = workOrder.owner_id;
      update.approved_at = new Date().toISOString();
    }
    if (action === "owner_reject") {
      update.approval_status = "rejected";
      update.approved_by = workOrder.owner_id;
      update.approved_at = new Date().toISOString();
    }
    // Clear held_from_status on resume
    if (action === "pm_resume") {
      update.held_from_status = null;
    }

    // Update work order with optimistic lock — only succeeds if status hasn't changed
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("work_order")
      .update(update)
      .eq("id", id)
      .eq("status", workOrder.status)  // optimistic lock
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: "Conflict: work order status was modified by another request. Please retry." },
        { status: 409 }
      );
    }

    // Log status history
    await supabaseAdmin.from("work_order_status_history").insert({
      work_order_id: id,
      from_status: workOrder.status,
      to_status: result.newStatus,
      action,
      actor_id: actor_id || null,
      actor_role: actor_role || null,
      notes: hold_reason || null,
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
});
