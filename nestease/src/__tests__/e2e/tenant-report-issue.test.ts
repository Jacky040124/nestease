/**
 * E2E Scenario 4: Tenant Reports Issue → Follow-up Work Order
 * 完工 → 待验收 → 租户报问题 → 原工单完成 + 创建跟进工单
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { transitionWorkOrder } from "@/services/work-order-state-machine";
import { WorkOrderStatus } from "@/types";
import { PM, OWNER, TENANT, CONTRACTOR, makeWorkOrder } from "../helpers/fixtures";

// ── Shared setup ──────────────────────────────────────────────
const setup = vi.hoisted(() => require("../helpers/e2e-setup").createE2ESetup());
vi.mock("@/lib/supabase", setup.supabaseMockFactory);
vi.mock("@/lib/sms", setup.smsMockFactory);

const { smsCalls, seedTable, findRows, resetState } = setup;

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
  seedTable("contractor", [CONTRACTOR]);
  seedTable("notification", []);
  seedTable("work_order", []);
}

describe("E2E: Tenant Reports Issue", () => {
  let wo: ReturnType<typeof makeWorkOrder>;

  beforeEach(() => {
    seedDB();
    smsCalls.length = 0;
    wo = makeWorkOrder({
      contractor_id: CONTRACTOR.id,
      status: WorkOrderStatus.PendingVerification,
    });
    seedTable("work_order", [wo]);
  });

  it("待验收 → 租户报问题 → 原工单完成 + 创建跟进工单", async () => {
    const result = transitionWorkOrder(
      WorkOrderStatus.PendingVerification,
      "tenant_report_issue",
      { workOrderId: wo.id, pmSettings }
    );

    // Original work order completes
    expect(result.newStatus).toBe(WorkOrderStatus.Completed);

    // Should have notify PM + create follow-up side effects
    expect(result.sideEffects).toContainEqual(
      expect.objectContaining({ type: "notify", target: "pm", event: "tenant_reported_issue" })
    );
    expect(result.sideEffects).toContainEqual(
      expect.objectContaining({ type: "create_follow_up_work_order", parent_work_order_id: wo.id })
    );

    await processSideEffects(result.sideEffects, wo as any, { pmSettings });

    // PM notified about issue
    expect(smsCalls.filter(c => c.body.includes("仍有问题"))).toHaveLength(1);

    // Follow-up work order created in DB
    const followUps = findRows("work_order", { parent_work_order_id: wo.id });
    expect(followUps).toHaveLength(1);
    expect(followUps[0].status).toBe(WorkOrderStatus.PendingAssignment);
    expect(followUps[0].description).toContain("[Follow-up]");
    expect(followUps[0].property_id).toBe(wo.property_id);
    expect(followUps[0].tenant_id).toBe(wo.tenant_id);
    expect(followUps[0].pm_id).toBe(wo.pm_id);
  });
});
