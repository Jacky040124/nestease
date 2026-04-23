/**
 * E2E Scenario 5: Hold and Resume
 * 任意状态 → 挂起 → 恢复到原状态 → 继续正常流程
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { transitionWorkOrder } from "@/services/work-order-state-machine";
import { WorkOrderStatus } from "@/types";
import { PM, OWNER, TENANT, CONTRACTOR, makeWorkOrder } from "../helpers/fixtures";

// ── Shared setup ──────────────────────────────────────────────
const setup = vi.hoisted(() => require("../helpers/e2e-setup").createE2ESetup());
vi.mock("@/lib/supabase", setup.supabaseMockFactory);
vi.mock("@/lib/sms", setup.smsMockFactory);

const { smsCalls, seedTable, resetState } = setup;

import { processSideEffects } from "@/lib/side-effects-processor";

const pmSettings = {
  auto_approval_enabled: PM.auto_approval_enabled,
  auto_approval_threshold: PM.auto_approval_threshold,
  follow_up_wait_days: PM.follow_up_wait_days,
  notification_channel: PM.notification_channel as "sms",
};

describe("E2E: Hold and Resume", () => {
  beforeEach(() => {
    resetState();
    seedTable("pm", [PM]);
    seedTable("owner", [OWNER]);
    seedTable("tenant", [TENANT]);
    seedTable("contractor", [CONTRACTOR]);
    seedTable("notification", []);
  });

  it("报价中 → 挂起 → 恢复到报价中", async () => {
    const wo = makeWorkOrder({ status: WorkOrderStatus.Quoting, contractor_id: CONTRACTOR.id });

    // ── Hold ──
    const holdResult = transitionWorkOrder(
      WorkOrderStatus.Quoting, "pm_hold",
      { workOrderId: wo.id, pmSettings }
    );
    expect(holdResult.newStatus).toBe(WorkOrderStatus.OnHold);
    expect(holdResult.sideEffects).toContainEqual({
      type: "save_held_from_status",
      status: WorkOrderStatus.Quoting,
    });

    const holdFx = await processSideEffects(holdResult.sideEffects, wo as any, { pmSettings });
    expect(holdFx.held_from_status).toBe(WorkOrderStatus.Quoting);

    // ── Resume ──
    const resumeResult = transitionWorkOrder(
      WorkOrderStatus.OnHold, "pm_resume",
      { workOrderId: wo.id, pmSettings, heldFromStatus: WorkOrderStatus.Quoting }
    );
    expect(resumeResult.newStatus).toBe(WorkOrderStatus.Quoting);
    expect(resumeResult.sideEffects).toHaveLength(0);
  });

  it("施工中 → 挂起 → 恢复到施工中", async () => {
    const wo = makeWorkOrder({ status: WorkOrderStatus.InProgress, contractor_id: CONTRACTOR.id });

    const holdResult = transitionWorkOrder(
      WorkOrderStatus.InProgress, "pm_hold",
      { workOrderId: wo.id, pmSettings }
    );
    expect(holdResult.newStatus).toBe(WorkOrderStatus.OnHold);

    const holdFx = await processSideEffects(holdResult.sideEffects, wo as any, { pmSettings });
    expect(holdFx.held_from_status).toBe(WorkOrderStatus.InProgress);

    const resumeResult = transitionWorkOrder(
      WorkOrderStatus.OnHold, "pm_resume",
      { workOrderId: wo.id, pmSettings, heldFromStatus: WorkOrderStatus.InProgress }
    );
    expect(resumeResult.newStatus).toBe(WorkOrderStatus.InProgress);
  });

  it("待审批 → 挂起 → 恢复 → 继续批准到施工中", async () => {
    const wo = makeWorkOrder({
      status: WorkOrderStatus.PendingApproval,
      contractor_id: CONTRACTOR.id,
    });

    // Hold
    const holdResult = transitionWorkOrder(
      WorkOrderStatus.PendingApproval, "pm_hold",
      { workOrderId: wo.id, pmSettings }
    );
    expect(holdResult.newStatus).toBe(WorkOrderStatus.OnHold);

    const holdFx = await processSideEffects(holdResult.sideEffects, wo as any, { pmSettings });
    expect(holdFx.held_from_status).toBe(WorkOrderStatus.PendingApproval);

    // Resume
    const resumeResult = transitionWorkOrder(
      WorkOrderStatus.OnHold, "pm_resume",
      { workOrderId: wo.id, pmSettings, heldFromStatus: WorkOrderStatus.PendingApproval }
    );
    expect(resumeResult.newStatus).toBe(WorkOrderStatus.PendingApproval);

    // Now approve
    smsCalls.length = 0;
    const approveResult = transitionWorkOrder(
      WorkOrderStatus.PendingApproval, "owner_approve",
      { workOrderId: wo.id, pmSettings }
    );
    expect(approveResult.newStatus).toBe(WorkOrderStatus.InProgress);

    await processSideEffects(approveResult.sideEffects, wo as any, { pmSettings });
    expect(smsCalls.filter(c => c.body.includes("已获业主批准"))).toHaveLength(1);
    expect(smsCalls.filter(c => c.body.includes("报价已批准"))).toHaveLength(1);
  });

  it("resume defaults to pending_assignment when heldFromStatus is not provided", () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.OnHold, "pm_resume",
      { workOrderId: "wo-1", pmSettings }
    );
    expect(result.newStatus).toBe(WorkOrderStatus.PendingAssignment);
  });
});
