// ============================================================
// Work Order State Machine — Comprehensive Tests
// Based on PRD v1 Section 3 (状态机)
// ============================================================

import { describe, it, expect } from "vitest";
import {
  transitionWorkOrder,
  InvalidTransitionError,
  getAvailableActions,
} from "@/services/work-order-state-machine";
import {
  WorkOrderStatus,
  PMSettings,
  NotificationChannel,
} from "@/types";

// ── Test helpers ────────────────────────────────────────────

const defaultContext = {
  workOrderId: "wo-001",
};

function makeSettings(overrides: Partial<PMSettings> = {}): PMSettings {
  return {
    auto_approval_enabled: false,
    auto_approval_threshold: 300,
    follow_up_wait_days: 10,
    notification_channel: NotificationChannel.SMS,
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════
// 1. NORMAL FLOW (happy path)
// 待分配 → 已派单 → 报价中 → 施工中 → 待验收 → 已完成
// ════════════════════════════════════════════════════════════

describe("Normal flow (happy path)", () => {
  it("待分配 → 已派单: PM assigns contractor", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.PendingAssignment,
      "pm_assign_contractor",
      defaultContext
    );
    expect(result.newStatus).toBe(WorkOrderStatus.Assigned);
    expect(result.sideEffects).toContainEqual({
      type: "notify",
      target: "contractor",
      event: "new_work_order",
    });
  });

  it("已派单 → 报价中: Contractor starts quoting", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.Assigned,
      "contractor_start_quote",
      defaultContext
    );
    expect(result.newStatus).toBe(WorkOrderStatus.Quoting);
  });

  it("报价中 → 施工中: Auto-approved (below threshold)", () => {
    const settings = makeSettings({
      auto_approval_enabled: true,
      auto_approval_threshold: 300,
    });
    const result = transitionWorkOrder(
      WorkOrderStatus.Quoting,
      "submit_quote",
      { ...defaultContext, pmSettings: settings, quoteAmount: 200 }
    );
    expect(result.newStatus).toBe(WorkOrderStatus.InProgress);
    expect(result.sideEffects).toContainEqual({ type: "auto_approve" });
  });

  it("施工中 → 待验收: Contractor submits completion", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.InProgress,
      "contractor_submit_completion",
      defaultContext
    );
    expect(result.newStatus).toBe(WorkOrderStatus.PendingVerification);
    expect(result.sideEffects).toContainEqual({
      type: "notify",
      target: "tenant",
      event: "completion_submitted",
    });
    expect(result.sideEffects).toContainEqual({
      type: "notify",
      target: "pm",
      event: "completion_submitted",
    });
  });

  it("待验收 → 已完成: Tenant confirms", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.PendingVerification,
      "tenant_confirm",
      defaultContext
    );
    expect(result.newStatus).toBe(WorkOrderStatus.Completed);
  });

  it("full happy path: PendingAssignment → Completed", () => {
    const settings = makeSettings({
      auto_approval_enabled: true,
      auto_approval_threshold: 500,
    });
    const ctx = { workOrderId: "wo-full", pmSettings: settings };

    let status = WorkOrderStatus.PendingAssignment;

    // Step 1: Assign
    let result = transitionWorkOrder(status, "pm_assign_contractor", ctx);
    status = result.newStatus;
    expect(status).toBe(WorkOrderStatus.Assigned);

    // Step 2: Start quote
    result = transitionWorkOrder(status, "contractor_start_quote", ctx);
    status = result.newStatus;
    expect(status).toBe(WorkOrderStatus.Quoting);

    // Step 3: Submit quote (auto-approved)
    result = transitionWorkOrder(status, "submit_quote", { ...ctx, quoteAmount: 250 });
    status = result.newStatus;
    expect(status).toBe(WorkOrderStatus.InProgress);

    // Step 4: Submit completion
    result = transitionWorkOrder(status, "contractor_submit_completion", ctx);
    status = result.newStatus;
    expect(status).toBe(WorkOrderStatus.PendingVerification);

    // Step 5: Tenant confirms
    result = transitionWorkOrder(status, "tenant_confirm", ctx);
    status = result.newStatus;
    expect(status).toBe(WorkOrderStatus.Completed);
  });
});

// ════════════════════════════════════════════════════════════
// 2. APPROVAL FLOW
// 报价中 → 待审批 → 施工中 (approve) / 待分配 (reject)
// ════════════════════════════════════════════════════════════

describe("Approval flow", () => {
  it("报价中 → 待审批: Quote exceeds threshold", () => {
    const settings = makeSettings({
      auto_approval_enabled: true,
      auto_approval_threshold: 300,
    });
    const result = transitionWorkOrder(
      WorkOrderStatus.Quoting,
      "submit_quote",
      { ...defaultContext, pmSettings: settings, quoteAmount: 500 }
    );
    expect(result.newStatus).toBe(WorkOrderStatus.PendingApproval);
    expect(result.sideEffects).toContainEqual({ type: "require_approval" });
    // Owner approval handled offline (PM downloads PDF and sends via WeChat)
    expect(result.sideEffects).toContainEqual({
      type: "notify",
      target: "pm",
      event: "quote_submitted",
    });
  });

  it("报价中 → 待审批: Auto-approval disabled (any amount)", () => {
    const settings = makeSettings({ auto_approval_enabled: false });
    const result = transitionWorkOrder(
      WorkOrderStatus.Quoting,
      "submit_quote",
      { ...defaultContext, pmSettings: settings, quoteAmount: 50 }
    );
    expect(result.newStatus).toBe(WorkOrderStatus.PendingApproval);
  });

  it("待审批 → 施工中: Owner approves", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.PendingApproval,
      "owner_approve",
      defaultContext
    );
    expect(result.newStatus).toBe(WorkOrderStatus.InProgress);
    expect(result.sideEffects).toContainEqual({
      type: "notify",
      target: "pm",
      event: "owner_approved",
    });
    expect(result.sideEffects).toContainEqual({
      type: "notify",
      target: "contractor",
      event: "approved_start_work",
    });
  });

  it("待审批 → 待分配: Owner rejects", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.PendingApproval,
      "owner_reject",
      defaultContext
    );
    expect(result.newStatus).toBe(WorkOrderStatus.PendingAssignment);
    expect(result.sideEffects).toContainEqual({
      type: "notify",
      target: "pm",
      event: "owner_rejected",
    });
  });

  it("full approval path: Quoting → PendingApproval → InProgress → Completed", () => {
    const settings = makeSettings({
      auto_approval_enabled: true,
      auto_approval_threshold: 300,
    });
    const ctx = { workOrderId: "wo-approval", pmSettings: settings };

    // Submit expensive quote
    let result = transitionWorkOrder(
      WorkOrderStatus.Quoting,
      "submit_quote",
      { ...ctx, quoteAmount: 1000 }
    );
    expect(result.newStatus).toBe(WorkOrderStatus.PendingApproval);

    // Owner approves
    result = transitionWorkOrder(WorkOrderStatus.PendingApproval, "owner_approve", ctx);
    expect(result.newStatus).toBe(WorkOrderStatus.InProgress);

    // Complete
    result = transitionWorkOrder(WorkOrderStatus.InProgress, "contractor_submit_completion", ctx);
    expect(result.newStatus).toBe(WorkOrderStatus.PendingVerification);

    result = transitionWorkOrder(WorkOrderStatus.PendingVerification, "tenant_confirm", ctx);
    expect(result.newStatus).toBe(WorkOrderStatus.Completed);
  });
});

// ════════════════════════════════════════════════════════════
// 3. AUTO-APPROVAL BOUNDARY VALUES
// ════════════════════════════════════════════════════════════

describe("Auto-approval boundary values", () => {
  const threshold = 300;
  const settings = makeSettings({
    auto_approval_enabled: true,
    auto_approval_threshold: threshold,
  });

  it("quote exactly at threshold → auto-approved (<=)", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.Quoting,
      "submit_quote",
      { ...defaultContext, pmSettings: settings, quoteAmount: threshold }
    );
    expect(result.newStatus).toBe(WorkOrderStatus.InProgress);
  });

  it("quote $1 above threshold → needs approval", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.Quoting,
      "submit_quote",
      { ...defaultContext, pmSettings: settings, quoteAmount: threshold + 1 }
    );
    expect(result.newStatus).toBe(WorkOrderStatus.PendingApproval);
  });

  it("quote $0 → auto-approved", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.Quoting,
      "submit_quote",
      { ...defaultContext, pmSettings: settings, quoteAmount: 0 }
    );
    expect(result.newStatus).toBe(WorkOrderStatus.InProgress);
  });

  it("quote $1 below threshold → auto-approved", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.Quoting,
      "submit_quote",
      { ...defaultContext, pmSettings: settings, quoteAmount: threshold - 1 }
    );
    expect(result.newStatus).toBe(WorkOrderStatus.InProgress);
  });

  it("auto-approval disabled: $1 quote still needs approval", () => {
    const noAutoSettings = makeSettings({ auto_approval_enabled: false });
    const result = transitionWorkOrder(
      WorkOrderStatus.Quoting,
      "submit_quote",
      { ...defaultContext, pmSettings: noAutoSettings, quoteAmount: 1 }
    );
    expect(result.newStatus).toBe(WorkOrderStatus.PendingApproval);
  });
});

// ════════════════════════════════════════════════════════════
// 4. FOLLOW-UP FLOW
// 待验收 → tenant reports issue → 创建 follow-up 工单
// 待验收 → timeout → 自动完成
// ════════════════════════════════════════════════════════════

describe("Follow-up flow", () => {
  it("待验收 → 已完成: Tenant reports issue (original closes, creates follow-up)", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.PendingVerification,
      "tenant_report_issue",
      { workOrderId: "wo-original" }
    );
    // Original work order is completed (that round of repair is done)
    expect(result.newStatus).toBe(WorkOrderStatus.Completed);
    // Side effect creates a NEW follow-up work order
    expect(result.sideEffects).toContainEqual({
      type: "create_follow_up_work_order",
      parent_work_order_id: "wo-original",
    });
    expect(result.sideEffects).toContainEqual({
      type: "notify",
      target: "pm",
      event: "tenant_reported_issue",
    });
  });

  it("待验收 → 已完成: Auto timeout", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.PendingVerification,
      "auto_timeout",
      defaultContext
    );
    expect(result.newStatus).toBe(WorkOrderStatus.Completed);
  });

  it("待验收 → 已完成: PM manual close", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.PendingVerification,
      "pm_manual_close",
      defaultContext
    );
    expect(result.newStatus).toBe(WorkOrderStatus.Completed);
  });

  it("contractor_submit_completion sets follow-up deadline", () => {
    const settings = makeSettings({ follow_up_wait_days: 7 });
    const result = transitionWorkOrder(
      WorkOrderStatus.InProgress,
      "contractor_submit_completion",
      { ...defaultContext, pmSettings: settings }
    );
    expect(result.sideEffects).toContainEqual({
      type: "set_follow_up_deadline",
      days: 7,
    });
  });
});

// ════════════════════════════════════════════════════════════
// 5. CANCEL / HOLD (from any active status)
// ════════════════════════════════════════════════════════════

describe("Cancel from any active status", () => {
  const activeStatuses = [
    WorkOrderStatus.PendingAssignment,
    WorkOrderStatus.Assigned,
    WorkOrderStatus.Quoting,
    WorkOrderStatus.PendingApproval,
    WorkOrderStatus.InProgress,
    WorkOrderStatus.PendingVerification,
  ];

  activeStatuses.forEach((status) => {
    it(`${status} → cancelled`, () => {
      const result = transitionWorkOrder(status, "pm_cancel", defaultContext);
      expect(result.newStatus).toBe(WorkOrderStatus.Cancelled);
    });
  });

  it("cannot cancel an already completed work order", () => {
    expect(() =>
      transitionWorkOrder(WorkOrderStatus.Completed, "pm_cancel", defaultContext)
    ).toThrow(InvalidTransitionError);
  });

  it("cannot cancel an already cancelled work order", () => {
    expect(() =>
      transitionWorkOrder(WorkOrderStatus.Cancelled, "pm_cancel", defaultContext)
    ).toThrow(InvalidTransitionError);
  });
});

describe("Hold from any active status", () => {
  const activeStatuses = [
    WorkOrderStatus.PendingAssignment,
    WorkOrderStatus.Assigned,
    WorkOrderStatus.Quoting,
    WorkOrderStatus.PendingApproval,
    WorkOrderStatus.InProgress,
    WorkOrderStatus.PendingVerification,
  ];

  activeStatuses.forEach((status) => {
    it(`${status} → on_hold`, () => {
      const result = transitionWorkOrder(status, "pm_hold", defaultContext);
      expect(result.newStatus).toBe(WorkOrderStatus.OnHold);
    });
  });

  it("cannot hold a completed work order", () => {
    expect(() =>
      transitionWorkOrder(WorkOrderStatus.Completed, "pm_hold", defaultContext)
    ).toThrow(InvalidTransitionError);
  });

  it("on_hold → resumes to held_from_status (default: PendingAssignment)", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.OnHold,
      "pm_resume",
      defaultContext
    );
    expect(result.newStatus).toBe(WorkOrderStatus.PendingAssignment);
  });

  it("on_hold → resumes to InProgress when held from InProgress", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.OnHold,
      "pm_resume",
      { ...defaultContext, heldFromStatus: WorkOrderStatus.InProgress }
    );
    expect(result.newStatus).toBe(WorkOrderStatus.InProgress);
  });

  it("on_hold → resumes to Assigned when held from Assigned", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.OnHold,
      "pm_resume",
      { ...defaultContext, heldFromStatus: WorkOrderStatus.Assigned }
    );
    expect(result.newStatus).toBe(WorkOrderStatus.Assigned);
  });

  it("pm_hold saves held_from_status in side effects", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.InProgress,
      "pm_hold",
      defaultContext
    );
    expect(result.newStatus).toBe(WorkOrderStatus.OnHold);
    expect(result.sideEffects).toContainEqual({
      type: "save_held_from_status",
      status: WorkOrderStatus.InProgress,
    });
  });
});

// ════════════════════════════════════════════════════════════
// 6. INVALID TRANSITIONS (must reject)
// ════════════════════════════════════════════════════════════

describe("Invalid transitions", () => {
  it("待分配 cannot skip to 施工中", () => {
    expect(() =>
      transitionWorkOrder(
        WorkOrderStatus.PendingAssignment,
        "contractor_submit_completion",
        defaultContext
      )
    ).toThrow(InvalidTransitionError);
  });

  it("待分配 cannot go directly to 报价中", () => {
    expect(() =>
      transitionWorkOrder(
        WorkOrderStatus.PendingAssignment,
        "contractor_start_quote",
        defaultContext
      )
    ).toThrow(InvalidTransitionError);
  });

  it("已派单 cannot go directly to 施工中", () => {
    expect(() =>
      transitionWorkOrder(
        WorkOrderStatus.Assigned,
        "contractor_submit_completion",
        defaultContext
      )
    ).toThrow(InvalidTransitionError);
  });

  it("已完成 cannot transition to anything (except cancel/hold — which also fail)", () => {
    const actions = [
      "pm_assign_contractor",
      "contractor_start_quote",
      "submit_quote",
      "owner_approve",
      "owner_reject",
      "contractor_submit_completion",
      "tenant_confirm",
      "tenant_report_issue",
      "pm_cancel",
      "pm_hold",
      "pm_resume",
    ];
    for (const action of actions) {
      expect(() =>
        transitionWorkOrder(WorkOrderStatus.Completed, action, defaultContext)
      ).toThrow();
    }
  });

  it("已取消 cannot transition to anything", () => {
    const actions = [
      "pm_assign_contractor",
      "contractor_start_quote",
      "submit_quote",
      "owner_approve",
      "contractor_submit_completion",
      "tenant_confirm",
    ];
    for (const action of actions) {
      expect(() =>
        transitionWorkOrder(WorkOrderStatus.Cancelled, action, defaultContext)
      ).toThrow();
    }
  });

  it("owner_approve only works from PendingApproval", () => {
    const otherStatuses = [
      WorkOrderStatus.PendingAssignment,
      WorkOrderStatus.Assigned,
      WorkOrderStatus.Quoting,
      WorkOrderStatus.InProgress,
      WorkOrderStatus.PendingVerification,
      WorkOrderStatus.Completed,
    ];
    for (const status of otherStatuses) {
      expect(() =>
        transitionWorkOrder(status, "owner_approve", defaultContext)
      ).toThrow();
    }
  });

  it("tenant_confirm only works from PendingVerification", () => {
    const otherStatuses = [
      WorkOrderStatus.PendingAssignment,
      WorkOrderStatus.Assigned,
      WorkOrderStatus.Quoting,
      WorkOrderStatus.PendingApproval,
      WorkOrderStatus.InProgress,
      WorkOrderStatus.Completed,
    ];
    for (const status of otherStatuses) {
      expect(() =>
        transitionWorkOrder(status, "tenant_confirm", defaultContext)
      ).toThrow();
    }
  });

  it("unknown action throws error", () => {
    expect(() =>
      transitionWorkOrder(
        WorkOrderStatus.PendingAssignment,
        "nonexistent_action",
        defaultContext
      )
    ).toThrow("Unknown action: nonexistent_action");
  });
});

// ════════════════════════════════════════════════════════════
// 7. NOTIFICATION SIDE EFFECTS
// Verify PRD Section 6 notification triggers
// ════════════════════════════════════════════════════════════

describe("Notification side effects (PRD Section 6)", () => {
  it("PM指派contractor → notify contractor", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.PendingAssignment,
      "pm_assign_contractor",
      defaultContext
    );
    expect(result.sideEffects.filter((e) => e.type === "notify")).toEqual([
      { type: "notify", target: "contractor", event: "new_work_order" },
    ]);
  });

  it("submit_quote (needs approval) → notify PM + owner", () => {
    const settings = makeSettings({ auto_approval_enabled: false });
    const result = transitionWorkOrder(
      WorkOrderStatus.Quoting,
      "submit_quote",
      { ...defaultContext, pmSettings: settings, quoteAmount: 100 }
    );
    const notifications = result.sideEffects.filter((e) => e.type === "notify");
    expect(notifications).toContainEqual({
      type: "notify",
      target: "pm",
      event: "quote_submitted",
    });
    // Owner approval handled offline (PM downloads PDF and sends via WeChat)
    expect(notifications).not.toContainEqual(
      expect.objectContaining({ target: "owner", event: "approval_needed" })
    );
  });

  it("submit_quote (auto-approved) → notify PM + contractor", () => {
    const settings = makeSettings({
      auto_approval_enabled: true,
      auto_approval_threshold: 500,
    });
    const result = transitionWorkOrder(
      WorkOrderStatus.Quoting,
      "submit_quote",
      { ...defaultContext, pmSettings: settings, quoteAmount: 200 }
    );
    const notifications = result.sideEffects.filter((e) => e.type === "notify");
    expect(notifications).toContainEqual({
      type: "notify",
      target: "pm",
      event: "quote_submitted",
    });
    expect(notifications).toContainEqual({
      type: "notify",
      target: "contractor",
      event: "approved_start_work",
    });
  });

  it("owner_approve → notify PM + contractor", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.PendingApproval,
      "owner_approve",
      defaultContext
    );
    const notifications = result.sideEffects.filter((e) => e.type === "notify");
    expect(notifications).toHaveLength(2);
    expect(notifications).toContainEqual({
      type: "notify",
      target: "pm",
      event: "owner_approved",
    });
    expect(notifications).toContainEqual({
      type: "notify",
      target: "contractor",
      event: "approved_start_work",
    });
  });

  it("owner_reject → notify PM", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.PendingApproval,
      "owner_reject",
      defaultContext
    );
    const notifications = result.sideEffects.filter((e) => e.type === "notify");
    expect(notifications).toEqual([
      { type: "notify", target: "pm", event: "owner_rejected" },
    ]);
  });

  it("contractor_submit_completion → notify PM + tenant", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.InProgress,
      "contractor_submit_completion",
      defaultContext
    );
    const notifications = result.sideEffects.filter((e) => e.type === "notify");
    expect(notifications).toContainEqual({
      type: "notify",
      target: "pm",
      event: "completion_submitted",
    });
    expect(notifications).toContainEqual({
      type: "notify",
      target: "tenant",
      event: "completion_submitted",
    });
  });

  it("tenant_report_issue → notify PM", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.PendingVerification,
      "tenant_report_issue",
      { workOrderId: "wo-001" }
    );
    const notifications = result.sideEffects.filter((e) => e.type === "notify");
    expect(notifications).toContainEqual({
      type: "notify",
      target: "pm",
      event: "tenant_reported_issue",
    });
  });
});

// ════════════════════════════════════════════════════════════
// 8. getAvailableActions
// ════════════════════════════════════════════════════════════

describe("getAvailableActions", () => {
  it("PendingAssignment: assign, cancel, hold", () => {
    const actions = getAvailableActions(WorkOrderStatus.PendingAssignment);
    expect(actions).toContain("pm_assign_contractor");
    expect(actions).toContain("pm_cancel");
    expect(actions).toContain("pm_hold");
    expect(actions).not.toContain("contractor_start_quote");
  });

  it("Assigned: start quote, cancel, hold", () => {
    const actions = getAvailableActions(WorkOrderStatus.Assigned);
    expect(actions).toContain("contractor_start_quote");
    expect(actions).toContain("pm_cancel");
  });

  it("Quoting: submit_quote (not raw auto/manual triggers), cancel, hold", () => {
    const actions = getAvailableActions(WorkOrderStatus.Quoting);
    expect(actions).toContain("submit_quote");
    expect(actions).not.toContain("quote_auto_approved");
    expect(actions).not.toContain("quote_needs_approval");
  });

  it("PendingApproval: approve, reject, cancel, hold", () => {
    const actions = getAvailableActions(WorkOrderStatus.PendingApproval);
    expect(actions).toContain("owner_approve");
    expect(actions).toContain("owner_reject");
  });

  it("InProgress: submit completion, cancel, hold", () => {
    const actions = getAvailableActions(WorkOrderStatus.InProgress);
    expect(actions).toContain("contractor_submit_completion");
  });

  it("PendingVerification: confirm, report issue, manual close, timeout, cancel, hold", () => {
    const actions = getAvailableActions(WorkOrderStatus.PendingVerification);
    expect(actions).toContain("tenant_confirm");
    expect(actions).toContain("pm_manual_close");
    expect(actions).toContain("auto_timeout");
    expect(actions).toContain("tenant_report_issue");
  });

  it("Completed: no actions available", () => {
    const actions = getAvailableActions(WorkOrderStatus.Completed);
    expect(actions).toHaveLength(0);
  });

  it("Cancelled: no actions available", () => {
    const actions = getAvailableActions(WorkOrderStatus.Cancelled);
    expect(actions).toHaveLength(0);
  });

  it("OnHold: only pm_resume", () => {
    const actions = getAvailableActions(WorkOrderStatus.OnHold);
    expect(actions).toContain("pm_resume");
    expect(actions).toHaveLength(1);
  });
});

// ════════════════════════════════════════════════════════════
// 9. PM SETTINGS VARIATIONS
// ════════════════════════════════════════════════════════════

describe("PM Settings variations", () => {
  it("custom threshold $100: $100 auto-approved, $101 needs approval", () => {
    const settings = makeSettings({
      auto_approval_enabled: true,
      auto_approval_threshold: 100,
    });

    const r1 = transitionWorkOrder(
      WorkOrderStatus.Quoting,
      "submit_quote",
      { ...defaultContext, pmSettings: settings, quoteAmount: 100 }
    );
    expect(r1.newStatus).toBe(WorkOrderStatus.InProgress);

    const r2 = transitionWorkOrder(
      WorkOrderStatus.Quoting,
      "submit_quote",
      { ...defaultContext, pmSettings: settings, quoteAmount: 101 }
    );
    expect(r2.newStatus).toBe(WorkOrderStatus.PendingApproval);
  });

  it("custom follow-up days: reflected in side effects", () => {
    const settings = makeSettings({ follow_up_wait_days: 14 });
    const result = transitionWorkOrder(
      WorkOrderStatus.InProgress,
      "contractor_submit_completion",
      { ...defaultContext, pmSettings: settings }
    );
    expect(result.sideEffects).toContainEqual({
      type: "set_follow_up_deadline",
      days: 14,
    });
  });

  it("default settings used when none provided", () => {
    // No pmSettings → auto_approval disabled → always needs approval
    const result = transitionWorkOrder(
      WorkOrderStatus.Quoting,
      "submit_quote",
      { workOrderId: "wo-no-settings", quoteAmount: 1 }
    );
    expect(result.newStatus).toBe(WorkOrderStatus.PendingApproval);
  });
});
