/**
 * E2E Scenario 3: Rejection → Reassignment
 * 报价 → 待审批 → 拒绝 → 回到待分配 → 重新派单
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { transitionWorkOrder } from "@/services/work-order-state-machine";
import { WorkOrderStatus } from "@/types";
import { PM, OWNER, TENANT, CONTRACTOR, CONTRACTOR_2, makeWorkOrder } from "../helpers/fixtures";

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
  seedTable("tenant", [TENANT]);
  seedTable("contractor", [CONTRACTOR, CONTRACTOR_2]);
  seedTable("notification", []);
  seedTable("work_order", []);
}

describe("E2E: Rejection → Reassignment", () => {
  let wo: ReturnType<typeof makeWorkOrder>;

  beforeEach(() => {
    seedDB();
    smsCalls.length = 0;
    wo = makeWorkOrder({ contractor_id: CONTRACTOR.id });
    seedTable("work_order", [wo]);
  });

  it("报价 → 待审批 → 拒绝 → 待分配 → 重新派单给新contractor", async () => {
    // ── Fast-forward to pending_approval ──
    // Step 1: assign
    const s1 = transitionWorkOrder(WorkOrderStatus.PendingAssignment, "pm_assign_contractor", { workOrderId: wo.id, pmSettings });
    await processSideEffects(s1.sideEffects, { ...wo, contractor_id: CONTRACTOR.id } as any, { extraContractorId: CONTRACTOR.id, pmSettings });
    wo.status = s1.newStatus;

    // Step 2: accept
    const s2 = transitionWorkOrder(WorkOrderStatus.Assigned, "contractor_start_quote", { workOrderId: wo.id, pmSettings });
    wo.status = s2.newStatus;

    // Step 3: quote over threshold
    const s3 = transitionWorkOrder(WorkOrderStatus.Quoting, "submit_quote", { workOrderId: wo.id, pmSettings, quoteAmount: 500 });
    await processSideEffects(s3.sideEffects, wo as any, { amount: 500, pmSettings });
    wo.status = s3.newStatus;
    expect(wo.status).toBe(WorkOrderStatus.PendingApproval);

    // ── Step 4: Owner/PM rejects ──
    smsCalls.length = 0;
    const s4 = transitionWorkOrder(WorkOrderStatus.PendingApproval, "owner_reject", { workOrderId: wo.id, pmSettings });

    expect(s4.newStatus).toBe(WorkOrderStatus.PendingAssignment);

    const fx4 = await processSideEffects(s4.sideEffects, wo as any, { pmSettings });

    // PM gets owner_rejected notification
    expect(smsCalls.filter(c => c.body.includes("被业主拒绝"))).toHaveLength(1);

    wo.status = s4.newStatus;

    // ── Step 5: PM reassigns to new contractor ──
    smsCalls.length = 0;
    const s5 = transitionWorkOrder(WorkOrderStatus.PendingAssignment, "pm_assign_contractor", { workOrderId: wo.id, pmSettings });

    expect(s5.newStatus).toBe(WorkOrderStatus.Assigned);

    await processSideEffects(s5.sideEffects, { ...wo, contractor_id: CONTRACTOR_2.id } as any, {
      extraContractorId: CONTRACTOR_2.id, pmSettings,
    });

    // New contractor should receive new_work_order SMS
    expect(smsCalls.filter(c => c.body.includes("新工单通知"))).toHaveLength(1);
    const sms = smsCalls.filter(c => c.body.includes("新工单通知"))[0];
    expect(sms.to).toBe(CONTRACTOR_2.phone);
  });
});
