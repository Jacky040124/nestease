/**
 * E2E: Tenant Reports Issue + Follow-up Work Order (Real Supabase)
 *
 * Full flow to pending_verification → tenant_report_issue →
 * original WO completed with follow_up_status=has_issue →
 * new follow-up work order auto-created.
 *
 * Run: npx vitest run src/__tests__/e2e/tenant-report-issue-real.test.ts
 */
import { describe, it, expect, afterAll } from "vitest";
import {
  isConfigured,
  setupTestEnv,
  createWorkOrder,
  createContractor,
  advanceToQuoted,
  cleanupTestEnv,
  authedApi,
  TestEnv,
} from "./helpers/real-db-setup";

describe("E2E: Tenant Report Issue + Follow-up Work Order", { timeout: 30000 }, () => {
  let env: TestEnv;
  let workOrderId: string;
  let tenantId: string;
  let contractorId: string;

  if (!isConfigured()) {
    it.skip("Skipping: SUPABASE env vars not set", () => {});
    return;
  }

  afterAll(async () => {
    if (env) await cleanupTestEnv(env);
  });

  // ── Setup ─────────────────────────────────────────────────────
  it("Setup: 创建测试环境（自动审批）", async () => {
    env = await setupTestEnv();
    // auto_approval_enabled is already set to true in setupTestEnv

    const wo = await createWorkOrder(env);
    workOrderId = wo.workOrderId;
    tenantId = wo.tenantId;
    contractorId = await createContractor(env);
  });

  // ── Advance to in_progress ────────────────────────────────────
  it("Step 1: 报价自动审批 → in_progress", async () => {
    const result = await advanceToQuoted(env, workOrderId, contractorId, {
      labor_hours: 2,
      labor_rate: 80,
      materials: [],
    });
    expect(result.autoApproved).toBe(true);
    expect(result.status).toBe("in_progress");
  });

  // ── Submit completion report → pending_verification ───────────
  it("Step 2: 提交完工报告 → pending_verification", async () => {
    const res = await authedApi(`/api/work-orders/${workOrderId}/completion-report`, env.accessToken, {
      method: "POST",
      body: JSON.stringify({
        contractor_id: contractorId,
        work_type: "repair",
        work_description: "e2e_test 维修完成",
        actual_materials: [],
        actual_labor_hours: 1,
        actual_labor_rate: 80,
        actual_other_cost: 0,
        completion_photos: [],
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.work_order.status).toBe("pending_verification");
    expect(json.data.work_order.follow_up_status).toBe("pending_confirmation");
  });

  // ── Tenant reports issue ──────────────────────────────────────
  it("Step 3: 租户报问题 → completed + has_issue", async () => {
    const res = await authedApi(`/api/work-orders/${workOrderId}/transition`, env.accessToken, {
      method: "POST",
      body: JSON.stringify({
        action: "tenant_report_issue",
        actor_id: tenantId,
        actor_role: "tenant",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe("completed");
    expect(json.data.follow_up_status).toBe("has_issue");
    expect(json.data.completed_at).toBeTruthy();
  });

  // ── Verify follow-up work order was created ───────────────────
  it("Step 4: 验证 follow-up 工单已自动创建", async () => {
    const { data: followUps } = await env.admin
      .from("work_order")
      .select("*")
      .eq("parent_work_order_id", workOrderId);

    expect(followUps).not.toBeNull();
    expect(followUps!.length).toBe(1);

    const followUp = followUps![0];
    expect(followUp.status).toBe("pending_assignment");
    expect(followUp.description).toContain("[Follow-up]");
    expect(followUp.pm_id).toBe(env.pmId);
    expect(followUp.property_id).toBe(env.propertyId);
    // Follow-up should not have a contractor assigned yet
    expect(followUp.contractor_id).toBeNull();

    // Track follow-up for cleanup
    env.cleanupIds.workOrderIds.push(followUp.id);
  });

  // ── Verify original work order audit trail ────────────────────
  it("Step 5: 验证原工单状态历史", async () => {
    const { data: history } = await env.admin
      .from("work_order_status_history")
      .select("from_status, to_status, action")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: true });

    expect(history).not.toBeNull();
    const transitions = history!.map((h) => `${h.from_status || "null"} → ${h.to_status}`);
    expect(transitions).toContain("null → pending_assignment");
    expect(transitions).toContain("in_progress → pending_verification");
    expect(transitions).toContain("pending_verification → completed");
  });
});
