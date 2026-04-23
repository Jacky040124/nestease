/**
 * Outbound Notifier: listens for work order status changes via Supabase Realtime
 * and sends notifications to contractors via the Agent.
 *
 * Status changes that trigger contractor notifications:
 * - PendingApproval → InProgress (owner approved) → "报价批了，可以施工了"
 * - PendingApproval → PendingAssignment (owner rejected) → "报价没通过"
 * - Any → Cancelled (pm cancelled) → "活儿取消了"
 * - PendingVerification → Completed (verified) → "验收通过，辛苦了"
 * - PendingAssignment → Assigned (pm assigned) → "有新活儿"
 *
 * For contractor notifications: use Agent to generate natural language, then SMS.
 * For non-contractor notifications (PM, owner, tenant): skip — handled by nestease app.
 */

import { supabase } from "../lib/supabase.js";
import { sendSystemMessage, invalidateSessionCache } from "./session-manager.js";
import { sendSMS } from "../sms/sender.js";
import { COMPANY_NAME } from "../config/constants.js";
import { normalizePhone, phoneVariants } from "../lib/phone.js";

interface WorkOrderChange {
  id: string;
  status: string;
  contractor_id: string | null;
  pm_id: string;
  property_address: string;
  unit: string | null;
  description: string;
}

// Map status transitions to notification context for the Agent
const STATUS_NOTIFICATION_MAP: Record<
  string,
  { message: string; shouldNotify: boolean }
> = {
  in_progress: {
    message: "系统通知：工单报价已获业主批准，工单状态变为施工中。请通知师傅可以安排施工，完工后拍照告诉你。",
    shouldNotify: true,
  },
  pending_assignment: {
    // Could be owner_reject (from pending_approval) or initial state
    // We only notify if it was a rejection (came from pending_approval)
    message: "系统通知：工单报价被业主拒绝。请通知师傅报价没通过，PM 会跟进。",
    shouldNotify: true,
  },
  cancelled: {
    message: "系统通知：工单已被 PM 取消。请通知师傅这个活取消了。",
    shouldNotify: true,
  },
  completed: {
    message: "系统通知：工单验收通过，已完成。请通知师傅验收完成，辛苦了。",
    shouldNotify: true,
  },
  assigned: {
    message: "系统通知：PM 已将此工单派给师傅。请通知师傅有新活儿，告诉他地址和问题描述，问他是否接单。",
    shouldNotify: true,
  },
};

export async function startOutboundNotifier() {
  console.log("[OutboundNotifier] Starting Supabase Realtime listener...");

  const channel = supabase
    .channel("work-order-agent-notifications")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "work_order",
      },
      async (payload) => {
        const newRecord = payload.new as WorkOrderChange;
        const oldRecord = payload.old as Partial<WorkOrderChange>;

        // Supabase Realtime only sends old.status if REPLICA IDENTITY FULL is set.
        // Fallback: query work_order_status_history for the latest transition.
        let oldStatus = oldRecord.status;
        const newStatus = newRecord.status;

        if (!oldStatus) {
          const { data: history } = await supabase
            .from("work_order_status_history")
            .select("from_status, to_status")
            .eq("work_order_id", newRecord.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (history && history.to_status === newStatus) {
            oldStatus = history.from_status;
          } else {
            console.log(`[OutboundNotifier] No status history for ${newRecord.id}, skipping`);
            return;
          }
        }

        if (oldStatus === newStatus) return;

        console.log(
          `[OutboundNotifier] Work order ${newRecord.id}: ${oldStatus} → ${newStatus}`,
        );

        // Only notify contractor
        if (!newRecord.contractor_id) {
          console.log(`[OutboundNotifier] No contractor assigned, skipping`);
          return;
        }

        // Check if this status change warrants a notification
        const notification = STATUS_NOTIFICATION_MAP[newStatus];
        if (!notification?.shouldNotify) {
          console.log(`[OutboundNotifier] Status ${newStatus} does not need contractor notification`);
          return;
        }

        // Special case: pending_assignment might be initial state (not rejection)
        // Only notify if previous status was pending_approval (= rejection)
        if (newStatus === "pending_assignment" && oldStatus !== "pending_approval") {
          console.log(`[OutboundNotifier] pending_assignment from ${oldStatus}, not a rejection — skipping`);
          return;
        }

        // Atomic dedup: claim this status history row so only one instance sends the notification.
        // During zero-downtime deploys, old + new instances both receive the same Realtime event.
        // Only the instance that flips contractor_notified from false → true proceeds.
        // Plain UPDATE without .limit()/.order() so PostgREST generates a simple
        // UPDATE ... WHERE, and PostgreSQL row-level locking ensures atomicity.
        // With .limit().order(), PostgREST wraps it in a CTE whose SELECT doesn't hold locks.
        const { data: claimed, error: claimErr } = await supabase
          .from("work_order_status_history")
          .update({ contractor_notified: true })
          .eq("work_order_id", newRecord.id)
          .eq("to_status", newStatus)
          .eq("contractor_notified", false)
          .select("id");

        if (claimErr) {
          console.error(`[OutboundNotifier] Dedup claim error:`, claimErr);
          return;
        }

        if (!claimed || claimed.length === 0) {
          console.log(`[OutboundNotifier] Already notified for ${newRecord.id} → ${newStatus}, skipping (dedup)`);
          return;
        }

        console.log(`[OutboundNotifier] Claimed notification for ${newRecord.id} → ${newStatus}`);

        // Look up contractor phone
        const { data: contractor } = await supabase
          .from("contractor")
          .select("phone, name")
          .eq("id", newRecord.contractor_id)
          .single();

        if (!contractor?.phone) {
          console.log(`[OutboundNotifier] Contractor ${newRecord.contractor_id} has no phone`);
          return;
        }

        const address = newRecord.unit
          ? `${newRecord.property_address} Unit ${newRecord.unit}`
          : newRecord.property_address;

        // Build context message for the Agent
        const systemMsg = `${notification.message}\n\n工单信息：\n- 工单ID: ${newRecord.id}\n- 地址: ${address}\n- 问题: ${newRecord.description}\n- 师傅: ${contractor.name}`;

        try {
          // When a new work order is assigned, suspend other active sessions for this phone
          // so only the new PM's agent "owns" the SMS channel
          if (newStatus === "assigned") {
            const normalized = normalizePhone(contractor.phone);
            const variants = phoneVariants(normalized);
            await supabase
              .from("agent_sessions")
              .update({ status: "suspended" })
              .in("sms_number", [normalized, ...variants])
              .neq("contractor_id", newRecord.contractor_id)
              .eq("status", "active");
            // Invalidate cache so stale entries from suspended sessions aren't reused
            invalidateSessionCache(normalized);
            for (const v of variants) invalidateSessionCache(v);
            console.log(`[OutboundNotifier] Suspended other active sessions for phone ${normalized}`);
          }

          // Use the Agent to generate a natural language notification
          const agentReply = await sendSystemMessage(
            newRecord.contractor_id,
            newRecord.pm_id,
            contractor.phone,
            systemMsg,
          );

          if (agentReply) {
            await sendSMS(contractor.phone, agentReply);
            console.log(`[OutboundNotifier] Sent notification to ${contractor.name}: ${agentReply.slice(0, 80)}...`);
          }
        } catch (err) {
          console.error(`[OutboundNotifier] Failed to notify contractor:`, err);
          // Fallback: send a simple template message
          const fallbackMsg = getFallbackMessage(newStatus, address);
          if (fallbackMsg) {
            await sendSMS(contractor.phone, fallbackMsg);
          }
        }
      },
    )
    .subscribe((status) => {
      console.log(`[OutboundNotifier] Realtime subscription status: ${status}`);
    });

  return channel;
}

function getFallbackMessage(status: string, address: string): string {
  switch (status) {
    case "in_progress":
      return `【${COMPANY_NAME}】${address} 的报价已批准，可以安排施工了`;
    case "cancelled":
      return `【${COMPANY_NAME}】${address} 的工单已取消`;
    case "completed":
      return `【${COMPANY_NAME}】${address} 的工单已验收通过，辛苦了`;
    default:
      return "";
  }
}
