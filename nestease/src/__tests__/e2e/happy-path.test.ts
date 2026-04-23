/**
 * E2E Scenario 1: Happy Path (Auto-Approval)
 * 创建工单 → 派单 → 确认接单 → 报价(自动批准) → 完工 → 验收
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

// ── Helpers ───────────────────────────────────────────────────

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
  seedTable("work_order_status_history", []);
  seedTable("work_order", []);
  seedTable("quote", []);
  seedTable("completion_report", []);
}

// ── Tests ─────────────────────────────────────────────────────

describe("E2E: Happy Path (Auto-Approval)", () => {
  let wo: ReturnType<typeof makeWorkOrder>;

  beforeEach(() => {
    seedDB();
    smsCalls.length = 0;
    wo = makeWorkOrder();
    seedTable("work_order", [wo]);
  });

  it("full flow: 待分配 → 已派单 → 报价中 → 施工中(自动批准) → 待验收 → 已完成", async () => {
    // ── Step 1: PM assigns contractor ──────────────────────
    const step1 = transitionWorkOrder(
      WorkOrderStatus.PendingAssignment,
      "pm_assign_contractor",
      { workOrderId: wo.id, pmSettings }
    );
    expect(step1.newStatus).toBe(WorkOrderStatus.Assigned);

    const fx1 = await processSideEffects(step1.sideEffects, {
      ...wo, contractor_id: CONTRACTOR.id,
    } as any, { extraContractorId: CONTRACTOR.id, pmSettings });

    // Contractor should receive new_work_order SMS
    expect(smsCalls.filter(c => c.body.includes("新工单通知"))).toHaveLength(1);

    // Update work order state
    wo.status = step1.newStatus;
    wo.contractor_id = CONTRACTOR.id;

    // ── Step 2: Contractor accepts job ─────────────────────
    smsCalls.length = 0;
    const step2 = transitionWorkOrder(
      WorkOrderStatus.Assigned,
      "contractor_start_quote",
      { workOrderId: wo.id, pmSettings }
    );
    expect(step2.newStatus).toBe(WorkOrderStatus.Quoting);
    expect(step2.sideEffects).toHaveLength(0);

    wo.status = step2.newStatus;

    // ── Step 3: Contractor submits quote (under threshold → auto-approve) ──
    smsCalls.length = 0;
    const quoteAmount = 200; // Under 300 threshold
    const step3 = transitionWorkOrder(
      WorkOrderStatus.Quoting,
      "submit_quote",
      { workOrderId: wo.id, pmSettings, quoteAmount }
    );
    expect(step3.newStatus).toBe(WorkOrderStatus.InProgress);
    expect(step3.sideEffects).toContainEqual({ type: "auto_approve" });

    const fx3 = await processSideEffects(step3.sideEffects, wo as any, {
      amount: quoteAmount,
      pmSettings,
    });

    // Should auto-approve
    expect(fx3.approval_required).toBe(false);
    expect(fx3.approval_status).toBe("approved");

    // PM gets quote_submitted, contractor gets approved_start_work
    expect(smsCalls.filter(c => c.body.includes("报价已提交"))).toHaveLength(1);
    expect(smsCalls.filter(c => c.body.includes("报价已批准"))).toHaveLength(1);

    wo.status = step3.newStatus;

    // ── Step 4: Contractor submits completion report ───────
    smsCalls.length = 0;
    const step4 = transitionWorkOrder(
      WorkOrderStatus.InProgress,
      "contractor_submit_completion",
      { workOrderId: wo.id, pmSettings }
    );
    expect(step4.newStatus).toBe(WorkOrderStatus.PendingVerification);

    const fx4 = await processSideEffects(step4.sideEffects, wo as any, { pmSettings });

    // PM and tenant get completion_submitted
    expect(smsCalls.filter(c => c.body.includes("已完工"))).toHaveLength(2);

    // Follow-up deadline should be set
    expect(fx4.follow_up_status).toBe("pending_confirmation");
    expect(fx4.follow_up_deadline).toBeTruthy();

    wo.status = step4.newStatus;

    // ── Step 5: Tenant confirms ───────────────────────────
    smsCalls.length = 0;
    const step5 = transitionWorkOrder(
      WorkOrderStatus.PendingVerification,
      "tenant_confirm",
      { workOrderId: wo.id, pmSettings }
    );
    expect(step5.newStatus).toBe(WorkOrderStatus.Completed);
    expect(step5.sideEffects).toHaveLength(0);
  });
});
