/**
 * Unified side effects processor for work order state transitions.
 * Handles all effect types returned by transitionWorkOrder().
 */
import { supabaseAdmin } from "@/lib/supabase";
import { getNotificationMessage } from "@/lib/notification-messages";
import { dispatchNotification } from "@/lib/send-notification";
import { WorkOrderStatus, PMSettings } from "@/types";
import type { SideEffect } from "@/services/work-order-state-machine";

interface WorkOrderContext {
  id: string;
  pm_id: string;
  owner_id: string | null;
  contractor_id: string | null;
  tenant_id: string | null;
  property_id: string;
  property_address: string;
  unit: string | null;
  tenant_name: string;
  tenant_phone: string | null;
  category: string;
  description: string;
  photos: string[] | null;
  urgency: string;
}

interface ProcessOptions {
  /** Fallback actor ID used as default target when role-based lookup fails. */
  fallbackActorId?: string;
  /** Extra contractor_id (e.g. from request body during assignment). */
  extraContractorId?: string;
  /** Amount for notification messages (e.g. quote total). */
  amount?: number;
  /** PM settings for notification channel. */
  pmSettings?: PMSettings;
}

/** Fields that should be merged into the work_order UPDATE. */
export interface UpdateFields {
  approval_required?: boolean;
  approval_status?: string;
  follow_up_status?: string;
  follow_up_deadline?: string;
  follow_up_sent_at?: string;
  held_from_status?: string;
}

/**
 * Process all side effects from a state transition.
 * Returns update fields that should be applied to the work order.
 */
export async function processSideEffects(
  effects: SideEffect[],
  workOrder: WorkOrderContext,
  options: ProcessOptions = {},
): Promise<UpdateFields> {
  const update: UpdateFields = {};

  for (const effect of effects) {
    switch (effect.type) {
      case "auto_approve":
        update.approval_required = false;
        update.approval_status = "approved";
        break;

      case "require_approval":
        update.approval_required = true;
        update.approval_status = "pending";
        break;

      case "save_held_from_status":
        update.held_from_status = effect.status;
        break;

      case "set_follow_up_deadline": {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + effect.days);
        update.follow_up_status = "pending_confirmation";
        update.follow_up_deadline = deadline.toISOString();
        update.follow_up_sent_at = new Date().toISOString();
        break;
      }

      case "notify": {
        const targetId = resolveTargetId(effect.target, workOrder, options);
        if (!targetId) break;

        // Look up tenant email if needed
        let tenantEmail: string | undefined;
        if (effect.target === "contractor" && workOrder.tenant_id) {
          const { data: tenant } = await supabaseAdmin
            .from("tenant")
            .select("email")
            .eq("id", workOrder.tenant_id)
            .single();
          tenantEmail = tenant?.email || undefined;
        }

        const message = getNotificationMessage(effect.event, {
          workOrderId: workOrder.id,
          address: workOrder.property_address,
          unit: workOrder.unit || undefined,
          description: workOrder.description,
          amount: options.amount,
          tenantName: workOrder.tenant_name || undefined,
          tenantPhone: workOrder.tenant_phone || undefined,
          tenantEmail,
        });

        const { data: notif, error: notifyError } = await supabaseAdmin
          .from("notification")
          .insert({
            work_order_id: workOrder.id,
            target_role: effect.target,
            target_id: targetId,
            channel: options.pmSettings?.notification_channel || "sms",
            event: effect.event,
            message,
          })
          .select("id")
          .single();

        if (notifyError) {
          console.error(`Failed to create notification (${effect.event} → ${effect.target}):`, notifyError.message);
        }

        await dispatchNotification({
          notificationId: notif?.id,
          workOrderId: workOrder.id,
          targetRole: effect.target,
          targetId,
          event: effect.event,
          message,
        }).catch((err) => console.error("[notify] dispatch failed:", err));
        break;
      }

      case "create_follow_up_work_order":
        await supabaseAdmin.from("work_order").insert({
          status: WorkOrderStatus.PendingAssignment,
          property_id: workOrder.property_id,
          property_address: workOrder.property_address,
          unit: workOrder.unit,
          tenant_id: workOrder.tenant_id,
          tenant_name: workOrder.tenant_name,
          tenant_phone: workOrder.tenant_phone,
          category: workOrder.category,
          description: `[Follow-up] ${workOrder.description}`,
          photos: workOrder.photos,
          urgency: workOrder.urgency,
          owner_id: workOrder.owner_id,
          pm_id: workOrder.pm_id,
          parent_work_order_id: effect.parent_work_order_id,
        });
        break;
    }
  }

  return update;
}

function resolveTargetId(
  target: string,
  workOrder: WorkOrderContext,
  options: ProcessOptions,
): string | null {
  switch (target) {
    case "pm": return workOrder.pm_id;
    case "owner": return workOrder.owner_id;
    case "contractor": return workOrder.contractor_id || options.extraContractorId || null;
    case "tenant": return workOrder.tenant_id;
    default: return options.fallbackActorId || null;
  }
}
