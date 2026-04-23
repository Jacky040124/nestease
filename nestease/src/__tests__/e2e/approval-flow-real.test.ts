/**
 * E2E: Manual Approval Flow (Real Supabase)
 *
 * Disable auto-approval → quote > $300 → pending_approval →
 * PDF generation → owner_approve → in_progress → completion → verified
 *
 * Run: npx vitest run src/__tests__/e2e/approval-flow-real.test.ts
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

describe("E2E: Manual Approval Flow + PDF", { timeout: 30000 }, () => {
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
  it("Setup: 创建测试环境", async () => {
    env = await setupTestEnv();
    // Disable auto-approval for this test
    await env.admin.from("pm").update({ auto_approval_enabled: false }).eq("id", env.pmId);
  });

  it("Setup: 创建工单和师傅", async () => {
    const wo = await createWorkOrder(env);
    workOrderId = wo.workOrderId;
    tenantId = wo.tenantId;
    contractorId = await createContractor(env, "e2e_test_approval_contractor");
  });

  // ── Step 1: Assign + Accept ───────────────────────────────────
  it("Step 1: 派单 + 师傅接单", async () => {
    // Assign
    const assignRes = await authedApi(`/api/work-orders/${workOrderId}/transition`, env.accessToken, {
      method: "POST",
      body: JSON.stringify({ action: "pm_assign_contractor", contractor_id: contractorId, actor_role: "pm" }),
    });
    expect(assignRes.status).toBe(200);
    const assignJson = await assignRes.json();
    expect(assignJson.data.status).toBe("assigned");

    // Accept
    const acceptRes = await authedApi(`/api/work-orders/${workOrderId}/transition`, env.accessToken, {
      method: "POST",
      body: JSON.stringify({ action: "contractor_start_quote", actor_role: "contractor" }),
    });
    expect(acceptRes.status).toBe(200);
    const acceptJson = await acceptRes.json();
    expect(acceptJson.data.status).toBe("quoting");
  });

  // ── Step 2: Submit expensive quote → pending_approval ─────────
  it("Step 2: 提交高额报价 → pending_approval", async () => {
    const res = await authedApi(`/api/work-orders/${workOrderId}/quote`, env.accessToken, {
      method: "POST",
      body: JSON.stringify({
        contractor_id: contractorId,
        labor_hours: 5,
        labor_rate: 100,
        materials: [{ name: "高级配件", quantity: 3, unit_price: 50 }],
        other_cost: 0,
        estimated_completion: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
        notes: "e2e_test 需要业主审批的高额报价",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    // Total = 500 + 150 = $650, above $300 threshold → NOT auto-approved
    expect(json.auto_approved).toBe(false);
    expect(json.data.work_order.status).toBe("pending_approval");
  });

  // ── Step 3: PDF generation ────────────────────────────────────
  it("Step 3: 生成审批 PDF", async () => {
    const res = await authedApi(`/api/work-orders/${workOrderId}/pdf?type=approval`, env.accessToken);
    expect(res.status).toBe(200);

    const contentType = res.headers.get("content-type") || "";
    expect(contentType).toContain("text/html");

    const html = await res.text();
    expect(html.length).toBeGreaterThan(100);
    // Should contain work order and quote information
    expect(html).toContain("高级配件");
  });

  // ── Step 4: Owner approves ────────────────────────────────────
  it("Step 4: 业主批准报价 → in_progress", async () => {
    const res = await authedApi(`/api/work-orders/${workOrderId}/transition`, env.accessToken, {
      method: "POST",
      body: JSON.stringify({
        action: "owner_approve",
        actor_id: env.ownerId,
        actor_role: "owner",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe("in_progress");
    expect(json.data.approval_status).toBe("approved");
  });

  // ── Step 5: Completion + Tenant confirm ───────────────────────
  it("Step 5: 完工 + 租户验收 → completed", async () => {
    await advanceToCompleted(env, workOrderId, contractorId, tenantId);

    // Verify final state
    const { data: wo } = await env.admin.from("work_order").select("*").eq("id", workOrderId).single();
    expect(wo!.status).toBe("completed");
    expect(wo!.completed_at).toBeTruthy();
    expect(wo!.follow_up_status).toBe("confirmed");
  });

  // ── Step 6: Completion PDF ────────────────────────────────────
  it("Step 6: 生成完工 PDF", async () => {
    const res = await authedApi(`/api/work-orders/${workOrderId}/pdf?type=completion`, env.accessToken);
    expect(res.status).toBe(200);

    const contentType = res.headers.get("content-type") || "";
    expect(contentType).toContain("text/html");

    const html = await res.text();
    expect(html.length).toBeGreaterThan(100);
  });

  // ── Step 7: Verify audit trail ────────────────────────────────
  it("Step 7: 验证完整状态历史", async () => {
    const { data: history } = await env.admin
      .from("work_order_status_history")
      .select("from_status, to_status, action")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: true });

    expect(history).not.toBeNull();
    const transitions = history!.map((h) => `${h.from_status || "null"} → ${h.to_status}`);
    expect(transitions).toContain("null → pending_assignment");
    expect(transitions).toContain("pending_assignment → assigned");
    expect(transitions).toContain("assigned → quoting");
    expect(transitions).toContain("quoting → pending_approval");
    expect(transitions).toContain("pending_approval → in_progress");
    expect(transitions).toContain("in_progress → pending_verification");
    expect(transitions).toContain("pending_verification → completed");
  });
});
