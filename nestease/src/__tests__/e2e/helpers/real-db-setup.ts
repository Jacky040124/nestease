/**
 * Shared helpers for real-Supabase E2E tests.
 * Creates test PM, property, owner, contractor — cleans up after.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

export { SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY, BASE_URL };

export function isConfigured() {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

export function createAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

export function createAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ── API Helpers ─────────────────────────────────────────────────

export function api(path: string, options: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers as Record<string, string> },
    ...options,
  });
}

export function authedApi(path: string, token: string, options: RequestInit = {}) {
  return api(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers as Record<string, string>,
    },
  });
}

// ── Test Environment ────────────────────────────────────────────

export interface TestEnv {
  admin: SupabaseClient;
  accessToken: string;
  pmId: string;
  pmCode: string;
  ownerId: string;
  propertyId: string;
  cleanupIds: CleanupIds;
}

interface CleanupIds {
  authUserIds: string[];
  pmIds: string[];
  ownerIds: string[];
  propertyIds: string[];
  tenantIds: string[];
  contractorIds: string[];
  workOrderIds: string[];
}

function emptyCleanup(): CleanupIds {
  return {
    authUserIds: [],
    pmIds: [],
    ownerIds: [],
    propertyIds: [],
    tenantIds: [],
    contractorIds: [],
    workOrderIds: [],
  };
}

/**
 * Creates a full test environment: PM (registered + logged in), owner, property.
 * Returns everything needed to run work order tests.
 */
export async function setupTestEnv(): Promise<TestEnv> {
  const admin = createAdmin();
  const cleanup = emptyCleanup();

  const suffix = Date.now();
  const email = `e2e_test_${suffix}@test.local`;
  const password = "e2e_test_pass_123";

  // 1. Register PM
  const regRes = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      name: "e2e_test_PM",
      phone: `+1000${suffix.toString().slice(-7)}`,
    }),
  });
  const regJson = await regRes.json();
  if (regRes.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(regJson)}`);

  cleanup.authUserIds.push(regJson.user.id);
  cleanup.pmIds.push(regJson.pm.id);
  const pmId = regJson.pm.id;
  const pmCode = regJson.pm.pm_code;

  // 2. Login
  const anonClient = createAnonClient();
  const { data: loginData, error: loginErr } = await anonClient.auth.signInWithPassword({ email, password });
  if (loginErr) throw new Error(`Login failed: ${loginErr.message}`);
  const accessToken = loginData.session!.access_token;

  // 3. Complete onboarding
  await authedApi("/api/pm/agent-config", accessToken, {
    method: "PUT",
    body: JSON.stringify({ agent_name: "e2e_test_助手", agent_avatar: "default", agent_tone: "friendly" }),
  });

  // 4. Enable auto-approval
  await admin.from("pm").update({ auto_approval_enabled: true }).eq("id", pmId);

  // 5. Create owner
  const { data: owner } = await admin.from("owner").insert({
    name: "e2e_test_owner",
    phone: `+1001${suffix.toString().slice(-7)}`,
  }).select("id").single();
  cleanup.ownerIds.push(owner!.id);

  // 6. Create property
  const repairCode = `E2E${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { data: property } = await admin.from("property").insert({
    address: "e2e_test 123 Test St",
    unit: "101",
    owner_id: owner!.id,
    pm_id: pmId,
    repair_code: repairCode,
  }).select("id").single();
  cleanup.propertyIds.push(property!.id);

  return {
    admin,
    accessToken,
    pmId,
    pmCode,
    ownerId: owner!.id,
    propertyId: property!.id,
    cleanupIds: cleanup,
  };
}

/**
 * Creates a work order and returns its ID + tenant ID.
 */
export async function createWorkOrder(env: TestEnv): Promise<{ workOrderId: string; tenantId: string }> {
  const suffix = Date.now();
  const tenantPhone = `+1002${suffix.toString().slice(-7)}`;

  const res = await api("/api/public/work-orders", {
    method: "POST",
    body: JSON.stringify({
      property_id: env.propertyId,
      name: "e2e_test_tenant",
      phone: tenantPhone,
      category: "plumbing",
      description: "e2e_test 水管漏水",
      urgency: "normal",
    }),
  });
  const json = await res.json();
  if (res.status !== 201) throw new Error(`Work order creation failed: ${JSON.stringify(json)}`);

  env.cleanupIds.workOrderIds.push(json.data.id);

  // Find tenant
  const { data: tenant } = await env.admin.from("tenant")
    .select("id").eq("phone", tenantPhone).eq("property_id", env.propertyId).single();
  if (tenant) env.cleanupIds.tenantIds.push(tenant.id);

  return { workOrderId: json.data.id, tenantId: tenant?.id || "" };
}

/**
 * Creates a contractor and returns its ID.
 */
export async function createContractor(env: TestEnv, name?: string): Promise<string> {
  const suffix = Date.now() + Math.floor(Math.random() * 10000);
  const { data: contractor } = await env.admin.from("contractor").insert({
    name: name || "e2e_test_contractor",
    phone: `+1003${suffix.toString().slice(-7)}`,
    specialties: ["plumbing"],
    pm_id: env.pmId,
  }).select("id").single();
  env.cleanupIds.contractorIds.push(contractor!.id);
  return contractor!.id;
}

/**
 * Runs a work order through: assign → accept → quote → (auto-approve or pending_approval).
 * Returns the work order's current status.
 */
export async function advanceToQuoted(
  env: TestEnv,
  workOrderId: string,
  contractorId: string,
  quoteAmount: { labor_hours: number; labor_rate: number; materials?: { name: string; quantity: number; unit_price: number }[] },
): Promise<{ status: string; autoApproved: boolean }> {
  // Assign
  await authedApi(`/api/work-orders/${workOrderId}/transition`, env.accessToken, {
    method: "POST",
    body: JSON.stringify({ action: "pm_assign_contractor", contractor_id: contractorId, actor_role: "pm" }),
  });

  // Accept
  await authedApi(`/api/work-orders/${workOrderId}/transition`, env.accessToken, {
    method: "POST",
    body: JSON.stringify({ action: "contractor_start_quote", actor_role: "contractor" }),
  });

  // Quote
  const quoteRes = await authedApi(`/api/work-orders/${workOrderId}/quote`, env.accessToken, {
    method: "POST",
    body: JSON.stringify({
      contractor_id: contractorId,
      labor_hours: quoteAmount.labor_hours,
      labor_rate: quoteAmount.labor_rate,
      materials: quoteAmount.materials || [],
      other_cost: 0,
      estimated_completion: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
      notes: "e2e_test quote",
    }),
  });
  const quoteJson = await quoteRes.json();
  return {
    status: quoteJson.data.work_order.status,
    autoApproved: quoteJson.auto_approved,
  };
}

/**
 * Advances work order from in_progress to completed.
 */
export async function advanceToCompleted(
  env: TestEnv,
  workOrderId: string,
  contractorId: string,
  tenantId: string,
): Promise<void> {
  // Submit completion report
  await authedApi(`/api/work-orders/${workOrderId}/completion-report`, env.accessToken, {
    method: "POST",
    body: JSON.stringify({
      contractor_id: contractorId,
      work_type: "repair",
      work_description: "e2e_test 维修完成，测试正常",
      actual_materials: [],
      actual_labor_hours: 1,
      actual_labor_rate: 80,
      actual_other_cost: 0,
      completion_photos: [],
    }),
  });

  // Tenant confirm
  await authedApi(`/api/work-orders/${workOrderId}/transition`, env.accessToken, {
    method: "POST",
    body: JSON.stringify({ action: "tenant_confirm", actor_id: tenantId, actor_role: "tenant" }),
  });
}

/**
 * Clean up all test data in reverse dependency order.
 */
export async function cleanupTestEnv(env: TestEnv) {
  const { admin, cleanupIds: c } = env;

  // Break circular FKs: null out quote_id and completion_report_id on work orders
  for (const woId of c.workOrderIds) {
    await admin.from("work_order").update({ quote_id: null, completion_report_id: null, contractor_id: null }).eq("id", woId);
  }
  for (const woId of c.workOrderIds) {
    await admin.from("work_order_status_history").delete().eq("work_order_id", woId);
    await admin.from("notification").delete().eq("work_order_id", woId);
    await admin.from("quote").delete().eq("work_order_id", woId);
    await admin.from("completion_report").delete().eq("work_order_id", woId);
  }
  // Delete follow-up work orders (parent_work_order_id references)
  for (const woId of c.workOrderIds) {
    const { data: followUps } = await admin.from("work_order")
      .select("id").eq("parent_work_order_id", woId);
    for (const fu of followUps || []) {
      await admin.from("work_order").update({ quote_id: null, completion_report_id: null, contractor_id: null }).eq("id", fu.id);
      await admin.from("work_order_status_history").delete().eq("work_order_id", fu.id);
      await admin.from("notification").delete().eq("work_order_id", fu.id);
      await admin.from("quote").delete().eq("work_order_id", fu.id);
      await admin.from("completion_report").delete().eq("work_order_id", fu.id);
      await admin.from("work_order").delete().eq("id", fu.id);
    }
  }
  for (const woId of c.workOrderIds) {
    await admin.from("work_order").delete().eq("id", woId);
  }
  for (const id of c.contractorIds) {
    await admin.from("agent_conversation_log").delete().eq("contractor_id", id);
    await admin.from("agent_sessions").delete().eq("contractor_id", id);
    await admin.from("notification").delete().eq("recipient_id", id);
    await admin.from("contractor").delete().eq("id", id);
  }
  for (const id of c.tenantIds) {
    await admin.from("tenant").delete().eq("id", id);
  }
  for (const id of c.propertyIds) {
    await admin.from("property").delete().eq("id", id);
  }
  for (const id of c.ownerIds) {
    await admin.from("owner").delete().eq("id", id);
  }
  for (const id of c.pmIds) {
    await admin.from("pm").delete().eq("id", id);
  }
  for (const id of c.authUserIds) {
    await admin.auth.admin.deleteUser(id);
  }
}
