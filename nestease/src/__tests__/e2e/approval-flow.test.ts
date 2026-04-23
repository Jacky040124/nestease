/**
 * E2E Scenario 2: Approval Flow (Quote exceeds threshold)
 * 创建工单 → 派单 → 确认接单 → 报价(超阈值) → PM批准 → 施工 → 完工 → 验收
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { transitionWorkOrder } from "@/services/work-order-state-machine";
import { WorkOrderStatus } from "@/types";
import { PM, OWNER, TENANT, CONTRACTOR, PROPERTY, makeWorkOrder } from "../helpers/fixtures";

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

function seedDB() {
  resetState();
  seedTable("pm", [PM]);
  seedTable("owner", [OWNER]);
  seedTable("property", [PROPERTY]);
  seedTable("tenant", [TENANT]);
  seedTable("contractor", [CONTRACTOR]);
  seedTable("notification", []);
  seedTable("work_order", []);
}

describe("E2E: Approval Flow (超阈值)", () => {
  let wo: ReturnType<typeof makeWorkOrder>;

  beforeEach(() => {
    seedDB();
    smsCalls.length = 0;
    wo = makeWorkOrder({ contractor_id: CONTRACTOR.id });
    seedTable("work_order", [wo]);
  });

  it("报价超阈值 → 待审批 → PM批准 → 施工中 → 完工 → 验收", async () => {
    // ── Step 1: PM assigns contractor ──
    const step1 = transitionWorkOrder(
      WorkOrderStatus.PendingAssignment, "pm_assign_contractor",
      { workOrderId: wo.id, pmSettings }
    );
    expect(step1.newStatus).toBe(WorkOrderStatus.Assigned);
    await processSideEffects(step1.sideEffects, { ...wo, contractor_id: CONTRACTOR.id } as any, {
      extraContractorId: CONTRACTOR.id, pmSettings,
    });
    wo.status = step1.newStatus;

    // ── Step 2: Contractor accepts ──
    const step2 = transitionWorkOrder(
      WorkOrderStatus.Assigned, "contractor_start_quote",
      { workOrderId: wo.id, pmSettings }
    );
    wo.status = step2.newStatus;

    // ── Step 3: Contractor submits quote (OVER threshold) ──
    smsCalls.length = 0;
    const quoteAmount = 500; // Over 300 threshold
    const step3 = transitionWorkOrder(
      WorkOrderStatus.Quoting, "submit_quote",
      { workOrderId: wo.id, pmSettings, quoteAmount }
    );

    expect(step3.newStatus).toBe(WorkOrderStatus.PendingApproval);
    expect(step3.sideEffects).toContainEqual({ type: "require_approval" });
    expect(step3.sideEffects).not.toContainEqual(expect.objectContaining({ type: "auto_approve" }));

    const fx3 = await processSideEffects(step3.sideEffects, wo as any, {
      amount: quoteAmount, pmSettings,
    });

    expect(fx3.approval_required).toBe(true);
    expect(fx3.approval_status).toBe("pending");

    // PM should get quote_submitted notification
    expect(smsCalls.filter(c => c.body.includes("报价已提交"))).toHaveLength(1);

    wo.status = step3.newStatus;

    // ── Step 4: PM approves (on behalf of owner) ──
    smsCalls.length = 0;
    const step4 = transitionWorkOrder(
      WorkOrderStatus.PendingApproval, "owner_approve",
      { workOrderId: wo.id, pmSettings }
    );

    expect(step4.newStatus).toBe(WorkOrderStatus.InProgress);

    const fx4 = await processSideEffects(step4.sideEffects, wo as any, {
      amount: quoteAmount, pmSettings,
    });

    // PM gets owner_approved, contractor gets approved_start_work
    expect(smsCalls.filter(c => c.body.includes("已获业主批准"))).toHaveLength(1);
    expect(smsCalls.filter(c => c.body.includes("报价已批准"))).toHaveLength(1);

    // Contractor SMS should contain completion-report link
    const contractorSMS = smsCalls.filter(c => c.body.includes("报价已批准"))[0];
    expect(contractorSMS.body).toContain("/completion-report");
    expect(contractorSMS.body).toContain("完工后点击提交完工报告");

    wo.status = step4.newStatus;

    // ── Step 5: Contractor submits completion ──
    smsCalls.length = 0;
    const step5 = transitionWorkOrder(
      WorkOrderStatus.InProgress, "contractor_submit_completion",
      { workOrderId: wo.id, pmSettings }
    );
    expect(step5.newStatus).toBe(WorkOrderStatus.PendingVerification);
    await processSideEffects(step5.sideEffects, wo as any, { pmSettings });

    // PM and tenant notified
    expect(smsCalls.filter(c => c.body.includes("已完工"))).toHaveLength(2);

    wo.status = step5.newStatus;

    // ── Step 6: Tenant confirms ──
    const step6 = transitionWorkOrder(
      WorkOrderStatus.PendingVerification, "tenant_confirm",
      { workOrderId: wo.id, pmSettings }
    );
    expect(step6.newStatus).toBe(WorkOrderStatus.Completed);
  });
});
