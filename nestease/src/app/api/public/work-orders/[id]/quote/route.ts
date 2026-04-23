import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getPublicAuth, publicUnauthorizedResponse } from "@/lib/public-auth";
import { calculateCosts } from "@/lib/cost-calculator";
import { transitionWorkOrder, InvalidTransitionError } from "@/services/work-order-state-machine";
import { WorkOrderStatus, PMSettings } from "@/types";
import { processSideEffects } from "@/lib/side-effects-processor";

// POST /api/public/work-orders/[id]/quote — Contractor submits quote via signed link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getPublicAuth(request);
  if (!auth || auth.role !== "contractor") return publicUnauthorizedResponse();

  const { id } = await params;
  if (auth.workOrderId !== id) return publicUnauthorizedResponse();

  const body = await request.json();
  const { labor_hours, labor_rate, materials, other_cost, other_description, estimated_completion, notes } = body;

  const { data: workOrder, error: fetchError } = await supabaseAdmin
    .from("work_order")
    .select("*, pm:pm_id(auto_approval_enabled, auto_approval_threshold, follow_up_wait_days, notification_channel)")
    .eq("id", id)
    .single();

  if (fetchError || !workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }
  if (workOrder.status !== "quoting") {
    return NextResponse.json({ error: `Cannot submit quote: work order is in ${workOrder.status} status` }, { status: 422 });
  }

  const { laborCost, materialsCost, otherCost, total, materialsWithSubtotals } =
    calculateCosts(labor_hours, labor_rate, materials, other_cost);

  const { data: quote, error: quoteError } = await supabaseAdmin
    .from("quote")
    .insert({
      work_order_id: id, contractor_id: workOrder.contractor_id,
      labor_hours: labor_hours || 0, labor_rate: labor_rate || 0, labor_cost: laborCost,
      materials: materialsWithSubtotals, materials_cost: materialsCost,
      other_cost: otherCost, other_description: other_description || null,
      total, estimated_completion: estimated_completion || null, notes: notes || null,
    })
    .select().single();

  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 500 });
  }

  const pm = workOrder.pm;
  const pmSettings: PMSettings | undefined = pm
    ? { auto_approval_enabled: pm.auto_approval_enabled, auto_approval_threshold: Number(pm.auto_approval_threshold), follow_up_wait_days: pm.follow_up_wait_days, notification_channel: pm.notification_channel }
    : undefined;

  try {
    const result = transitionWorkOrder(workOrder.status as WorkOrderStatus, "submit_quote", { workOrderId: id, pmSettings, quoteAmount: total });
    const update: Record<string, unknown> = { status: result.newStatus, quote_id: quote.id };

    const effectUpdates = await processSideEffects(result.sideEffects, workOrder, {
      fallbackActorId: auth.actorId,
      amount: total,
      pmSettings,
    });
    Object.assign(update, effectUpdates);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("work_order").update(update).eq("id", id).eq("status", workOrder.status).select().single();

    if (updateError || !updated) {
      await supabaseAdmin.from("quote").delete().eq("id", quote.id);
      return NextResponse.json({ error: "Conflict: work order status changed. Quote discarded, please retry." }, { status: 409 });
    }

    await supabaseAdmin.from("work_order_status_history").insert({
      work_order_id: id, from_status: workOrder.status, to_status: result.newStatus,
      action: "submit_quote", actor_id: auth.actorId, actor_role: "contractor",
    });

    return NextResponse.json({ data: { quote, work_order: updated }, auto_approved: result.sideEffects.some((e) => e.type === "auto_approve") }, { status: 201 });
  } catch (err) {
    await supabaseAdmin.from("quote").delete().eq("id", quote.id);
    if (err instanceof InvalidTransitionError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
