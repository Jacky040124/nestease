/**
 * E2E: Contractor Registration Flow (Real Supabase)
 *
 * send-otp → read OTP from DB → verify PM code → register → verify session → GET /me
 *
 * Run: npx vitest run src/__tests__/e2e/contractor-registration.test.ts
 */
import { describe, it, expect, afterAll } from "vitest";
import {
  isConfigured,
  setupTestEnv,
  cleanupTestEnv,
  api,
  TestEnv,
} from "./helpers/real-db-setup";

describe("E2E: Contractor Registration Flow", { timeout: 30000 }, () => {
  let env: TestEnv;
  const suffix = Date.now();
  const contractorPhone = `+1004${suffix.toString().slice(-7)}`;
  const contractorName = "e2e_test_contractor_reg";
  let contractorSession = "";
  let contractorId = "";

  if (!isConfigured()) {
    it.skip("Skipping: SUPABASE env vars not set", () => {});
    return;
  }

  afterAll(async () => {
    if (env) {
      // Clean up contractor auth user + record
      if (contractorId) {
        // Find and delete contractor auth user
        const { data: contractor } = await env.admin
          .from("contractor")
          .select("auth_id")
          .eq("id", contractorId)
          .single();
        if (contractor?.auth_id) {
          await env.admin.auth.admin.deleteUser(contractor.auth_id);
        }
        env.cleanupIds.contractorIds.push(contractorId);
      }
      // Clean up OTP records
      await env.admin.from("contractor_otp").delete().eq("phone", contractorPhone);
      await cleanupTestEnv(env);
    }
  });

  // ── Setup: PM environment ─────────────────────────────────────
  it("Setup: 创建 PM 测试环境", async () => {
    env = await setupTestEnv();
  });

  // ── Step 1: Verify PM Code ────────────────────────────────────
  it("Step 1: 验证 PM Code", async () => {
    const res = await api("/api/auth/contractor/verify-code", {
      method: "POST",
      body: JSON.stringify({ code: env.pmCode }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(true);
    expect(json.pm_name).toBeTruthy();
  });

  it("Step 1b: 无效 PM Code → invalid", async () => {
    const res = await api("/api/auth/contractor/verify-code", {
      method: "POST",
      body: JSON.stringify({ code: "XXXXXX" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(false);
  });

  // ── Step 2: Send OTP ──────────────────────────────────────────
  it("Step 2: 发送 OTP 验证码", async () => {
    const res = await api("/api/auth/contractor/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone: contractorPhone }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("Step 2b: 重复发送 OTP → 429 限流", async () => {
    const res = await api("/api/auth/contractor/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone: contractorPhone }),
    });

    // Should be rate limited (60s cooldown)
    expect(res.status).toBe(429);
  });

  // ── Step 3: Read OTP from DB (replaces real SMS) ──────────────
  it("Step 3: 从数据库读取 OTP", async () => {
    const { data: otp } = await env.admin
      .from("contractor_otp")
      .select("code, expires_at, used")
      .eq("phone", contractorPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    expect(otp).not.toBeNull();
    expect(otp!.code).toMatch(/^\d{6}$/);
    expect(otp!.used).toBe(false);
    expect(new Date(otp!.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  // ── Step 4: Register contractor ───────────────────────────────
  it("Step 4: 师傅注册（PM Code + OTP）", async () => {
    // Read OTP code from DB
    const { data: otp } = await env.admin
      .from("contractor_otp")
      .select("code")
      .eq("phone", contractorPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const res = await api("/api/auth/contractor/register", {
      method: "POST",
      body: JSON.stringify({
        pm_code: env.pmCode,
        name: contractorName,
        phone: contractorPhone,
        specialties: ["plumbing", "electrical"],
        otp: otp!.code,
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.session).toBeDefined();
    expect(json.session.access_token).toBeTruthy();
    expect(json.contractor).toBeDefined();
    expect(json.contractor.name).toBe(contractorName);

    contractorSession = json.session.access_token;
    contractorId = json.contractor.id;
  });

  // ── Step 5: Verify contractor record in DB ────────────────────
  it("Step 5: 验证师傅数据库记录", async () => {
    const { data: contractor } = await env.admin
      .from("contractor")
      .select("*")
      .eq("id", contractorId)
      .single();

    expect(contractor).not.toBeNull();
    expect(contractor!.name).toBe(contractorName);
    expect(contractor!.phone).toBe(contractorPhone);
    expect(contractor!.specialties).toContain("plumbing");
    expect(contractor!.specialties).toContain("electrical");
    expect(contractor!.pm_id).toBe(env.pmId);
    expect(contractor!.auth_id).toBeTruthy();
  });

  // ── Step 6: OTP marked as used ────────────────────────────────
  it("Step 6: OTP 已标记为已使用", async () => {
    const { data: otp } = await env.admin
      .from("contractor_otp")
      .select("used")
      .eq("phone", contractorPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    expect(otp!.used).toBe(true);
  });

  // ── Step 7: Login with OTP (existing contractor) ──────────────
  it("Step 7: 已注册师傅用 OTP 登录", async () => {
    // Wait for rate limit cooldown (send-otp has 60s limit)
    // Instead, directly insert an OTP for login test
    const loginCode = String(Math.floor(100000 + Math.random() * 900000));
    await env.admin.from("contractor_otp").insert({
      phone: contractorPhone,
      code: loginCode,
      expires_at: new Date(Date.now() + 5 * 60000).toISOString(),
      attempts: 0,
      used: false,
    });

    const res = await api("/api/auth/contractor/verify-otp", {
      method: "POST",
      body: JSON.stringify({
        phone: contractorPhone,
        code: loginCode,
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.session).toBeDefined();
    expect(json.session.access_token).toBeTruthy();
    expect(json.contractor.id).toBe(contractorId);
  });

  // ── Step 8: Validation errors ─────────────────────────────────
  it("Step 8: 注册验证错误", async () => {
    // Invalid phone format
    const r1 = await api("/api/auth/contractor/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone: "123" }),
    });
    expect(r1.status).toBe(422);

    // Missing PM code
    const r2 = await api("/api/auth/contractor/register", {
      method: "POST",
      body: JSON.stringify({
        name: "test",
        phone: "+19999999999",
        specialties: ["plumbing"],
        otp: "123456",
      }),
    });
    expect(r2.status).toBe(400);

    // Empty specialties
    const r3 = await api("/api/auth/contractor/register", {
      method: "POST",
      body: JSON.stringify({
        pm_code: env.pmCode,
        name: "test",
        phone: "+19999999998",
        specialties: [],
        otp: "123456",
      }),
    });
    expect(r3.status).toBe(422);
  });

  // ── Step 9: Duplicate registration → 409 ──────────────────────
  it("Step 9: 重复注册 → 409", async () => {
    // Insert fresh OTP for the duplicate attempt
    const dupCode = String(Math.floor(100000 + Math.random() * 900000));
    await env.admin.from("contractor_otp").insert({
      phone: contractorPhone,
      code: dupCode,
      expires_at: new Date(Date.now() + 5 * 60000).toISOString(),
      attempts: 0,
      used: false,
    });

    const res = await api("/api/auth/contractor/register", {
      method: "POST",
      body: JSON.stringify({
        pm_code: env.pmCode,
        name: contractorName,
        phone: contractorPhone,
        specialties: ["plumbing"],
        otp: dupCode,
      }),
    });

    expect(res.status).toBe(409);
  });
});
