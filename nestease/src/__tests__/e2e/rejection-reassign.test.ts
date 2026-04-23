/**
 * E2E: Quote Rejection + Reassignment (Real Supabase)
 *
 * Two contractors. First quote rejected by owner → back to pending_assignment →
 * reassign to second contractor → re-quote (auto-approved) → complete.
 *
 * Run: npx vitest run src/__tests__/e2e/rejection-reassign.test.ts
 */
import { describe, it, expect, afterAll } from "vitest";
import {
  isConfigured,
  setupTestEnv,
  createWorkOrder,
  createContractor,
  advanceToCompleted,
  cleanupTestEnv,
  authedApi,
  TestEnv,
} from "./helpers/real-db-setup";

describe("E2E: Rejection + Reassignment Flow", { timeout: 30000 }, () => {
  let env: TestEnv;
  let workOrderId: string;
  let tenantId: string;
  let contractor1Id: string;
  let contractor2Id: string;

  if (!isConfigured()) {
    it.skip("Skipping: SUPABASE env vars not set", () => {});
    return;
  }

  afterAll(async () => {
    if (env) await cleanupTestEnv(env);
  });

  // ── Setup ─────────────────────────────────────────────────────
  it("Setup: 创建测试环境（关闭自动审批）", async () => {
    env = await setupTestEnv();
    // Disable auto-approval so first quote goes to pending_approval
    await env.admin.from("pm").update({ auto_approval_enabled: false }).eq("id", env.pmId);

    const wo = await createWorkOrder(env);
    workOrderId = wo.workOrderId;
    tenantId = wo.tenantId;

    contractor1Id = await createContractor(env, "e2e_test_contractor_A");
    contractor2Id = await createContractor(env, "e2e_test_contractor_B");
  });

  // ── Round 1: Assign → Quote → Reject ─────────────────────────
  it("Round 1: 派单给师傅A → 报价 → 业主拒绝", async () => {
    // Assign to contractor 1
    const assignRes = await authedApi(`/api/work-orders/${workOrderId}/transition`, env.accessToken, {
      method: "POST",
      body: JSON.stringify({ action: "pm_assign_contractor", contractor_id: contractor1Id, actor_role: "pm" }),
    });
    expect(assignRes.status).toBe(200);

    // Contractor 1 accepts
    const acceptRes = await authedApi(`/api/work-orders/${workOrderId}/transition`, env.accessToken, {
      method: "POST",
      body: JSON.stringify({ action: "contractor_start_quote", actor_role: "contractor" }),
    });
    expect(acceptRes.status).toBe(200);

    // Contractor 1 submits quote ($500)
    const quoteRes = await authedApi(`/api/work-orders/${workOrderId}/quote`, env.accessToken, {
      method: "POST",
      body: JSON.stringify({
        contractor_id: contractor1Id,
        labor_hours: 5,
        labor_rate: 100,
        materials: [],
        other_cost: 0,
        estimated_completion: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
        notes: "e2e_test 师傅A的报价",
      }),
    });
    expect(quoteRes.status).toBe(201);
    const quoteJson = await quoteRes.json();
    expect(quoteJson.data.work_order.status).toBe("pending_approval");
    expect(quoteJson.auto_approved).toBe(false);

    // Owner rejects
    const rejectRes = await authedApi(`/api/work-orders/${workOrderId}/transition`, env.accessToken, {
      method: "POST",
      body: JSON.stringify({
        action: "owner_reject",
        actor_id: env.ownerId,
        actor_role: "owner",
      }),
    });
    expect(rejectRes.status).toBe(200);
    const rejectJson = await rejectRes.json();
    expect(rejectJson.data.status).toBe("pending_assignment");
    expect(rejectJson.data.approval_status).toBe("rejected");
  });

  // ── Round 2: Reassign → Quote (auto-approved) → Complete ─────
  it("Round 2: 重新派单给师傅B → 报价（自动审批）", async () => {
    // Enable auto-approval for round 2
    await env.admin.from("pm").update({ auto_approval_enabled: true }).eq("id", env.pmId);

    // Assign to contractor 2
    const assignRes = await authedApi(`/api/work-orders/${workOrderId}/transition`, env.accessToken, {
      method: "POST",
      body: JSON.stringify({ action: "pm_assign_contractor", contractor_id: contractor2Id, actor_role: "pm" }),
    });
    expect(assignRes.status).toBe(200);
    const assignJson = await assignRes.json();
    expect(assignJson.data.status).toBe("assigned");
    expect(assignJson.data.contractor_id).toBe(contractor2Id);

    // Contractor 2 accepts
    const acceptRes = await authedApi(`/api/work-orders/${workOrderId}/transition`, env.accessToken, {
      method: "POST",
      body: JSON.stringify({ action: "contractor_start_quote", actor_role: "contractor" }),
    });
    expect(acceptRes.status).toBe(200);

    // Contractor 2 submits cheaper quote ($160, under $300 threshold)
    const quoteRes = await authedApi(`/api/work-orders/${workOrderId}/quote`, env.accessToken, {
      method: "POST",
      body: JSON.stringify({
        contractor_id: contractor2Id,
        labor_hours: 2,
        labor_rate: 80,
        materials: [],
        other_cost: 0,
        estimated_completion: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
        notes: "e2e_test 师傅B的更优报价",
      }),
    });
    expect(quoteRes.status).toBe(201);
    const quoteJson = await quoteRes.json();
    expect(quoteJson.auto_approved).toBe(true);
    expect(quoteJson.data.work_order.status).toBe("in_progress");
  });

  it("Round 2: 完工 + 租户验收 → completed", async () => {
    await advanceToCompleted(env, workOrderId, contractor2Id, tenantId);

    const { data: wo } = await env.admin.from("work_order").select("*").eq("id", workOrderId).single();
    expect(wo!.status).toBe("completed");
    expect(wo!.completed_at).toBeTruthy();
  });

  // ── Verify full audit trail ───────────────────────────────────
  it("验证完整状态历史（含拒绝+重新派单）", async () => {
    const { data: history } = await env.admin
      .from("work_order_status_history")
      .select("from_status, to_status, action")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: true });

    expect(history).not.toBeNull();
    const transitions = history!.map((h) => `${h.from_status || "null"} → ${h.to_status}`);

    // Round 1: create → assign → quote → pending_approval → reject back to pending_assignment
    expect(transitions).toContain("null → pending_assignment");
    expect(transitions).toContain("pending_assignment → assigned");
    expect(transitions).toContain("assigned → quoting");
    expect(transitions).toContain("quoting → pending_approval");
    expect(transitions).toContain("pending_approval → pending_assignment");

    // Round 2: reassign → quote (auto) → in_progress → complete
    // Should have a second assigned transition
    const assignedCount = transitions.filter((t) => t.includes("→ assigned")).length;
    expect(assignedCount).toBeGreaterThanOrEqual(2);

    expect(transitions).toContain("quoting → in_progress"); // auto-approved skips pending_approval
    expect(transitions).toContain("in_progress → pending_verification");
    expect(transitions).toContain("pending_verification → completed");
  });
});
