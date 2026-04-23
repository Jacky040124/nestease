// ============================================================
// Work Order State Machine
// Handles all status transitions with validation
// ============================================================

import {
  WorkOrderStatus,
  ApprovalStatus,
  FollowUpStatus,
  PMSettings,
  DEFAULT_PM_SETTINGS,
  isValidTransition,
  VALID_TRANSITIONS,
} from "@/types";

export class InvalidTransitionError extends Error {
  constructor(from: WorkOrderStatus, to: WorkOrderStatus) {
    super(`Invalid transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export interface TransitionResult {
  newStatus: WorkOrderStatus;
  sideEffects: SideEffect[];
}

export type SideEffect =
  | { type: "notify"; target: "pm" | "tenant" | "contractor" | "owner"; event: string }
  | { type: "create_follow_up_work_order"; parent_work_order_id: string }
  | { type: "set_follow_up_deadline"; days: number }
  | { type: "auto_approve" }
  | { type: "require_approval" }
  | { type: "save_held_from_status"; status: WorkOrderStatus };

// ── Transition handlers ─────────────────────────────────────

export function transitionWorkOrder(
  currentStatus: WorkOrderStatus,
  action: string,
  context: {
    workOrderId: string;
    pmSettings?: PMSettings;
    quoteAmount?: number;
    holdReason?: string;
    heldFromStatus?: WorkOrderStatus;
  }
): TransitionResult {
  const settings = context.pmSettings ?? DEFAULT_PM_SETTINGS;

  switch (action) {
    case "pm_assign_contractor":
      assertStatus(currentStatus, WorkOrderStatus.PendingAssignment);
      return handleTransition(currentStatus, WorkOrderStatus.Assigned, [
        { type: "notify", target: "contractor", event: "new_work_order" },
      ]);

    case "contractor_start_quote":
      assertStatus(currentStatus, WorkOrderStatus.Assigned);
      return handleTransition(currentStatus, WorkOrderStatus.Quoting, []);

    case "submit_quote": {
      assertStatus(currentStatus, WorkOrderStatus.Quoting);
      const amount = context.quoteAmount ?? 0;

      if (settings.auto_approval_enabled && amount <= settings.auto_approval_threshold) {
        return {
          newStatus: WorkOrderStatus.InProgress,
          sideEffects: [
            { type: "auto_approve" },
            { type: "notify", target: "pm", event: "quote_submitted" },
            { type: "notify", target: "contractor", event: "approved_start_work" },
          ],
        };
      } else {
        return {
          newStatus: WorkOrderStatus.PendingApproval,
          sideEffects: [
            { type: "require_approval" },
            { type: "notify", target: "pm", event: "quote_submitted" },
            // Owner approval handled offline (PM downloads PDF and sends via WeChat)
          ],
        };
      }
    }

    case "owner_approve":
      assertStatus(currentStatus, WorkOrderStatus.PendingApproval);
      return handleTransition(currentStatus, WorkOrderStatus.InProgress, [
        { type: "notify", target: "pm", event: "owner_approved" },
        { type: "notify", target: "contractor", event: "approved_start_work" },
      ]);

    case "owner_reject":
      assertStatus(currentStatus, WorkOrderStatus.PendingApproval);
      return handleTransition(currentStatus, WorkOrderStatus.PendingAssignment, [
        { type: "notify", target: "pm", event: "owner_rejected" },
      ]);

    case "contractor_submit_completion":
      assertStatus(currentStatus, WorkOrderStatus.InProgress);
      return handleTransition(currentStatus, WorkOrderStatus.PendingVerification, [
        { type: "notify", target: "pm", event: "completion_submitted" },
        { type: "notify", target: "tenant", event: "completion_submitted" },
        { type: "set_follow_up_deadline", days: settings.follow_up_wait_days },
      ]);

    case "tenant_confirm":
      assertStatus(currentStatus, WorkOrderStatus.PendingVerification);
      return handleTransition(currentStatus, WorkOrderStatus.Completed, []);

    case "pm_manual_close":
      assertStatus(currentStatus, WorkOrderStatus.PendingVerification);
      return handleTransition(currentStatus, WorkOrderStatus.Completed, []);

    case "auto_timeout":
      assertStatus(currentStatus, WorkOrderStatus.PendingVerification);
      return handleTransition(currentStatus, WorkOrderStatus.Completed, []);

    case "tenant_report_issue":
      assertStatus(currentStatus, WorkOrderStatus.PendingVerification);
      // Original work order → Completed (that round of repair is done)
      // Side effect creates a NEW follow-up work order in PendingAssignment
      return {
        newStatus: WorkOrderStatus.Completed,
        sideEffects: [
          { type: "notify", target: "pm", event: "tenant_reported_issue" },
          { type: "create_follow_up_work_order", parent_work_order_id: context.workOrderId },
        ],
      };

    case "pm_cancel":
      return handleCancel(currentStatus);

    case "pm_hold":
      return handleHold(currentStatus);

    case "pm_resume": {
      assertStatus(currentStatus, WorkOrderStatus.OnHold);
      const resumeTo = context.heldFromStatus ?? WorkOrderStatus.PendingAssignment;
      return handleTransition(currentStatus, resumeTo, []);
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

function handleTransition(
  currentStatus: WorkOrderStatus,
  targetStatus: WorkOrderStatus,
  sideEffects: SideEffect[]
): TransitionResult {
  if (!isValidTransition(currentStatus, targetStatus)) {
    throw new InvalidTransitionError(currentStatus, targetStatus);
  }
  return { newStatus: targetStatus, sideEffects };
}

function assertStatus(current: WorkOrderStatus, expected: WorkOrderStatus) {
  if (current !== expected) {
    throw new InvalidTransitionError(current, expected);
  }
}

const CANCELLABLE_STATUSES = [
  WorkOrderStatus.PendingAssignment,
  WorkOrderStatus.Assigned,
  WorkOrderStatus.Quoting,
  WorkOrderStatus.PendingApproval,
  WorkOrderStatus.InProgress,
  WorkOrderStatus.PendingVerification,
];

function handleCancel(currentStatus: WorkOrderStatus): TransitionResult {
  if (!CANCELLABLE_STATUSES.includes(currentStatus)) {
    throw new InvalidTransitionError(currentStatus, WorkOrderStatus.Cancelled);
  }
  return {
    newStatus: WorkOrderStatus.Cancelled,
    sideEffects: [],
  };
}

function handleHold(currentStatus: WorkOrderStatus): TransitionResult {
  if (!CANCELLABLE_STATUSES.includes(currentStatus)) {
    throw new InvalidTransitionError(currentStatus, WorkOrderStatus.OnHold);
  }
  return {
    newStatus: WorkOrderStatus.OnHold,
    sideEffects: [
      { type: "save_held_from_status", status: currentStatus },
    ],
  };
}

// ── Query helpers ───────────────────────────────────────────

export function getAvailableActions(status: WorkOrderStatus): string[] {
  const actions: string[] = [];

  const transitions = VALID_TRANSITIONS.filter((t) => t.from === status);
  for (const t of transitions) {
    if (!actions.includes(t.trigger)) {
      actions.push(t.trigger);
    }
  }

  // submit_quote is a compound action that replaces quote_auto_approved / quote_needs_approval
  if (status === WorkOrderStatus.Quoting) {
    return actions
      .filter((a) => a !== "quote_auto_approved" && a !== "quote_needs_approval")
      .concat("submit_quote");
  }

  return actions;
}
