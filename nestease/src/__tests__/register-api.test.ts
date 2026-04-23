/**
 * Phase 2: PM Registration API
 * 10 test cases — validation, success, error handling, rollback.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks ─────────────────────────────────────────────
const { mockCreateUser, mockDeleteUser, mockInsert } = vi.hoisted(() => ({
  mockCreateUser: vi.fn(),
  mockDeleteUser: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
      },
    },
    from: vi.fn((table: string) => {
      const builder: Record<string, unknown> = {};
      builder.insert = (data: Record<string, unknown>) => ({
        select: () => ({
          single: () => mockInsert(table, data),
        }),
      });
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.maybeSingle = () => ({ data: null, error: null }); // pm_code collision check: no collision
      return builder;
    }),
  },
}));

import { POST } from "@/app/api/auth/register/route";

// ── Helpers ───────────────────────────────────────────────────
function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  email: "newpm@test.com",
  password: "secure123",
  name: "测试PM",
  phone: "+17781234567",
};

const fakeAuthUser = {
  id: "auth-user-1",
  email: "newpm@test.com",
};

const fakePmRow = {
  id: "pm-1",
  auth_id: "auth-user-1",
  name: "测试PM",
  email: "newpm@test.com",
  phone: "+17781234567",
};

// ── Tests ─────────────────────────────────────────────────────
describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateUser.mockResolvedValue({
      data: { user: fakeAuthUser },
      error: null,
    });
    mockInsert.mockReturnValue({
      data: fakePmRow,
      error: null,
    });
    mockDeleteUser.mockResolvedValue({ error: null });
  });

  // ── Success ─────────────────────────────────────────────────
  it("正常注册 → 201, 返回 user + pm 记录", async () => {
    const res = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.user).toBeDefined();
    expect(json.pm).toBeDefined();
    expect(json.pm.email).toBe(validBody.email);
  });

  // ── Validation errors ───────────────────────────────────────
  it("缺少邮箱 → 400", async () => {
    const { email, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("缺少密码 → 400", async () => {
    const { password, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("缺少姓名 → 400", async () => {
    const { name, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("邮箱格式无效 → 400", async () => {
    const res = await POST(makeRequest({ ...validBody, email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("密码太短(<6位) → 400", async () => {
    const res = await POST(makeRequest({ ...validBody, password: "12345" }));
    expect(res.status).toBe(400);
  });

  // ── Duplicate email ─────────────────────────────────────────
  it("重复邮箱注册 → 409", async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "User already registered", status: 422 },
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
  });

  // ── Supabase errors ─────────────────────────────────────────
  it("Supabase signUp 失败 → 500", async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Internal server error" },
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });

  it("signUp 成功但 pm 表插入失败 → 500, 回滚 auth user", async () => {
    mockInsert.mockReturnValue({
      data: null,
      error: { message: "DB insert failed" },
    });

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(500);
    // Should attempt to clean up orphaned auth user
    expect(mockDeleteUser).toHaveBeenCalledWith(fakeAuthUser.id);
  });

  // ── Auto-login ──────────────────────────────────────────────
  it("注册成功后返回 session 信息", async () => {
    const res = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.user).toBeDefined();
    expect(json.user.id).toBe(fakeAuthUser.id);
    // Must include session info for auto-login after registration
    expect(json.session).toBeDefined();
    expect(json.session.access_token).toBeTruthy();
  });
});
