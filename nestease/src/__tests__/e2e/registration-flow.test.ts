/**
 * E2E Integration Test: Registration → Onboarding → Work Order Complete Flow
 *
 * Runs against REAL Supabase — no mocks.
 * Uses unique test data with e2e_test_ prefix, cleaned up after each run.
 *
 * Run: npx vitest run src/__tests__/e2e/registration-flow.test.ts
 */
import { describe, it, expect, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

// Test data
const TEST_EMAIL = `e2e_test_${Date.now()}@test.local`;
const TEST_PASSWORD = "e2e_test_pass_123";
const TEST_PM_NAME = "e2e_test_PM";
const TEST_PHONE = "+10000000000";

// Cleanup tracker
const cleanup: {
  authUserId?: string;
  pmId?: string;
  propertyId?: string;
  ownerId?: string;
  tenantId?: string;
  workOrderId?: string;
  contractorId?: string;
} = {};

let admin: SupabaseClient;

// ── Helpers ─────────────────────────────────────────────────────

function api(path: string, options: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers as Record<string, string> },
    ...options,
  });
}

function authedApi(path: string, token: string, options: RequestInit = {}) {
  return api(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers as Record<string, string>,
    },
  });
}

// ── Test Suite ───────────────────────────────────────────────────

describe("E2E: Registration → Onboarding → Work Order Flow", () => {
  let accessToken = "";
  let pmId = "";
  let pmCode = "";
  let contractorId = "";

  // Skip if no Supabase configured
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    it.skip("Skipping: SUPABASE env vars not set", () => {});
    return;
  }

  admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── Cleanup ─────────────────────────────────────────────────
  afterAll(async () => {
    // Delete in reverse dependency order
    if (cleanup.workOrderId) {
      await admin.from("work_order_status_history").delete().eq("work_order_id", cleanup.workOrderId);
      await admin.from("notification").delete().eq("work_order_id", cleanup.workOrderId);
      await admin.from("quote").delete().eq("work_order_id", cleanup.workOrderId);
      await admin.from("completion_report").delete().eq("work_order_id", cleanup.workOrderId);
      await admin.from("work_order").delete().eq("id", cleanup.workOrderId);
    }
    if (cleanup.contractorId) {
      await admin.from("contractor").delete().eq("id", cleanup.contractorId);
    }
    if (cleanup.tenantId) {
      await admin.from("tenant").delete().eq("id", cleanup.tenantId);
    }
    if (cleanup.propertyId) {
      await admin.from("property").delete().eq("id", cleanup.propertyId);
    }
    if (cleanup.ownerId) {
      await admin.from("owner").delete().eq("id", cleanup.ownerId);
    }
    if (cleanup.pmId) {
      await admin.from("pm").delete().eq("id", cleanup.pmId);
    }
    if (cleanup.authUserId) {
      await admin.auth.admin.deleteUser(cleanup.authUserId);
    }
  });

  // ── Step 1: PM Registration ─────────────────────────────────
  it("Step 1: PM 注册 — POST /api/auth/register", async () => {
    const res = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_PM_NAME,
        phone: TEST_PHONE,
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();

    expect(json.user).toBeDefined();
    expect(json.user.email).toBe(TEST_EMAIL);
    expect(json.pm).toBeDefined();
    expect(json.pm.name).toBe(TEST_PM_NAME);
    expect(json.pm.pm_code).toBeTruthy();

    cleanup.authUserId = json.user.id;
    cleanup.pmId = json.pm.id;
    pmId = json.pm.id;
    pmCode = json.pm.pm_code;
  });

  // ── Step 2: PM Login ────────────────────────────────────────
  it("Step 2: PM 登录 — signInWithPassword", async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await anonClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(error).toBeNull();
    expect(data.session).toBeTruthy();
    accessToken = data.session!.access_token;
  });

  // ── Step 3: Onboarding ──────────────────────────────────────
  it("Step 3: Onboarding — GET + PUT /api/pm/agent-config", async () => {
    // GET should return default values
    const getRes = await authedApi("/api/pm/agent-config", accessToken);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.data.agent_name).toBe("小栖");
    expect(getJson.data.agent_avatar).toBeNull();

    // PUT to complete onboarding
    const putRes = await authedApi("/api/pm/agent-config", accessToken, {
      method: "PUT",
      body: JSON.stringify({
        agent_name: "e2e_test_助手",
        agent_avatar: "default",
        agent_tone: "friendly",
      }),
    });
    expect(putRes.status).toBe(200);

    // Verify update
    const verifyRes = await authedApi("/api/pm/agent-config", accessToken);
    const verifyJson = await verifyRes.json();
    expect(verifyJson.data.agent_name).toBe("e2e_test_助手");
    expect(verifyJson.data.agent_avatar).toBe("default");
    expect(verifyJson.data.agent_tone).toBe("friendly");
  });

  // ── Step 4: Enable auto-approval + seed property + owner ────
  it("Step 4: 创建测试物业和业主", async () => {
    // Enable auto-approval for this PM (default is false)
    await admin.from("pm").update({ auto_approval_enabled: true }).eq("id", pmId);

    // Create owner (owner table has no pm_id)
    const { data: owner, error: ownerErr } = await admin.from("owner").insert({
      name: "e2e_test_owner",
      phone: "+10000000001",
    }).select("id").single();
    expect(ownerErr).toBeNull();
    cleanup.ownerId = owner!.id;

    // Create property (repair_code is NOT NULL)
    const repairCode = `E2E${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const { data: property, error: propErr } = await admin.from("property").insert({
      address: "e2e_test 123 Test St",
      unit: "101",
      owner_id: owner!.id,
      pm_id: pmId,
      repair_code: repairCode,
    }).select("id").single();
    expect(propErr).toBeNull();
    cleanup.propertyId = property!.id;
  });

  // ── Step 5: Tenant submits work order ───────────────────────
  it("Step 5: 租户报修 — POST /api/public/work-orders", async () => {
    const res = await api("/api/public/work-orders", {
      method: "POST",
      body: JSON.stringify({
        property_id: cleanup.propertyId,
        name: "e2e_test_tenant",
        phone: "+10000000002",
        category: "plumbing",
        description: "e2e_test 水管漏水",
        urgency: "normal",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.status).toBe("pending_assignment");
    expect(json.data.pm_id).toBe(pmId);
    cleanup.workOrderId = json.data.id;

    // Find tenant for cleanup
    const { data: tenant } = await admin.from("tenant")
      .select("id").eq("phone", "+10000000002").eq("property_id", cleanup.propertyId).single();
    cleanup.tenantId = tenant?.id;
  });

  // ── Step 6: PM assigns contractor (seed contractor first) ───
  it("Step 6: PM 派单 — POST /api/work-orders/[id]/transition", async () => {
    // Create test contractor (via admin, no auth needed)
    const { data: contractor } = await admin.from("contractor").insert({
      name: "e2e_test_contractor",
      phone: "+10000000003",
      specialties: ["plumbing"],
      pm_id: pmId,
    }).select("id").single();

    contractorId = contractor!.id;
    cleanup.contractorId = contractorId;

    const res = await authedApi(`/api/work-orders/${cleanup.workOrderId}/transition`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        action: "pm_assign_contractor",
        contractor_id: contractorId,
        actor_role: "pm",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe("assigned");
    expect(json.data.contractor_id).toBe(contractorId);
  });

  // ── Step 7: Contractor accepts (接单) ────────────────────────
  it("Step 7: 师傅接单 — transition contractor_start_quote", async () => {
    const res = await authedApi(`/api/work-orders/${cleanup.workOrderId}/transition`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        action: "contractor_start_quote",
        actor_role: "contractor",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe("quoting");
  });

  // ── Step 8: Submit quote (auto-approval: ≤ $300) ────────────
  it("Step 8: 提交报价（自动批准）— POST /api/work-orders/[id]/quote", async () => {
    const res = await authedApi(`/api/work-orders/${cleanup.workOrderId}/quote`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        contractor_id: contractorId,
        labor_hours: 2,
        labor_rate: 80,
        materials: [{ name: "水管接头", quantity: 2, unit_price: 15 }],
        other_cost: 0,
        estimated_completion: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
        notes: "e2e_test 简单维修",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.quote).toBeDefined();
    expect(json.data.quote.labor_cost).toBe(160);
    expect(json.data.quote.materials_cost).toBe(30);
    // Total = 190, under $300 threshold → auto-approved
    expect(json.auto_approved).toBe(true);
    expect(json.data.work_order.status).toBe("in_progress");
  });

  // ── Step 9: Submit completion report ────────────────────────
  it("Step 9: 提交完工报告 — POST /api/work-orders/[id]/completion-report", async () => {
    const res = await authedApi(`/api/work-orders/${cleanup.workOrderId}/completion-report`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        contractor_id: contractorId,
        work_type: "repair",
        work_description: "e2e_test 更换水管接头，测试正常无漏水",
        actual_materials: [{ name: "水管接头", quantity: 2, unit_price: 15 }],
        actual_labor_hours: 1.5,
        actual_labor_rate: 80,
        actual_other_cost: 0,
        completion_photos: [],
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.completion_report).toBeDefined();
    expect(json.data.work_order.status).toBe("pending_verification");
    expect(json.data.work_order.follow_up_status).toBe("pending_confirmation");
  });

  // ── Step 10: Tenant confirms → completed ────────────────────
  it("Step 10: 租户验收 — transition tenant_confirm → completed", async () => {
    const res = await authedApi(`/api/work-orders/${cleanup.workOrderId}/transition`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        action: "tenant_confirm",
        actor_id: cleanup.tenantId,
        actor_role: "tenant",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe("completed");
    expect(json.data.follow_up_status).toBe("confirmed");
    expect(json.data.completed_at).toBeTruthy();
  });

  // ── Step 11: Verify audit trail ─────────────────────────────
  it("Step 11: 验证状态历史审计记录", async () => {
    const { data: history } = await admin
      .from("work_order_status_history")
      .select("from_status, to_status, action")
      .eq("work_order_id", cleanup.workOrderId!)
      .order("created_at", { ascending: true });

    expect(history).not.toBeNull();
    expect(history!.length).toBeGreaterThanOrEqual(6);

    const transitions = history!.map((h) => `${h.from_status || "null"} → ${h.to_status}`);
    expect(transitions).toContain("null → pending_assignment");
    expect(transitions).toContain("pending_assignment → assigned");
    expect(transitions).toContain("assigned → quoting");
    expect(transitions).toContain("quoting → in_progress");
    expect(transitions).toContain("in_progress → pending_verification");
    expect(transitions).toContain("pending_verification → completed");
  });

  // ── Step 12: Duplicate registration → 409 ───────────────────
  it("Step 12: 重复注册 → 409", async () => {
    const res = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_PM_NAME,
      }),
    });
    expect(res.status).toBe(409);
  });

  // ── Step 13: Registration validation errors ─────────────────
  it("Step 13: 注册验证 — 缺少字段 → 400", async () => {
    // No email
    const r1 = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ password: "123456", name: "test" }),
    });
    expect(r1.status).toBe(400);

    // No password
    const r2 = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "x@x.com", name: "test" }),
    });
    expect(r2.status).toBe(400);

    // Short password
    const r3 = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "x@x.com", password: "123", name: "test" }),
    });
    expect(r3.status).toBe(400);

    // Invalid email
    const r4 = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "notanemail", password: "123456", name: "test" }),
    });
    expect(r4.status).toBe(400);

    // No phone
    const r5 = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "x@x.com", password: "123456", name: "test" }),
    });
    expect(r5.status).toBe(400);
  });
});
