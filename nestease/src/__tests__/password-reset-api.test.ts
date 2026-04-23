/**
 * Phase 3: Forgot Password / Reset Password API
 * 8 test cases — send reset email + reset password with token.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks ─────────────────────────────────────────────
const { mockResetPasswordForEmail, mockUpdateUserById, mockGetUser } = vi.hoisted(() => ({
  mockResetPasswordForEmail: vi.fn(),
  mockUpdateUserById: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        updateUserById: mockUpdateUserById,
      },
      resetPasswordForEmail: mockResetPasswordForEmail,
      getUser: mockGetUser,
    },
  },
}));

import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";

// ── Helpers ───────────────────────────────────────────────────
function makeRequest(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests: Forgot Password ───────────────────────────────────
describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  });

  it("发送重置邮件（有效邮箱）→ 200", async () => {
    const res = await forgotPassword(
      makeRequest("/api/auth/forgot-password", { email: "pm@test.com" })
    );
    expect(res.status).toBe(200);
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith("pm@test.com", expect.any(Object));
  });

  it("发送重置邮件（不存在的邮箱）→ 仍返回 200（安全考虑）", async () => {
    // Supabase doesn't error for non-existent emails
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const res = await forgotPassword(
      makeRequest("/api/auth/forgot-password", { email: "nobody@test.com" })
    );
    expect(res.status).toBe(200);
  });

  it("缺少邮箱参数 → 400", async () => {
    const res = await forgotPassword(
      makeRequest("/api/auth/forgot-password", {})
    );
    expect(res.status).toBe(400);
  });

  it("邮箱格式无效 → 400", async () => {
    const res = await forgotPassword(
      makeRequest("/api/auth/forgot-password", { email: "not-an-email" })
    );
    expect(res.status).toBe(400);
  });
});

// ── Tests: Reset Password ────────────────────────────────────
describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "pm@test.com" } },
      error: null,
    });
    mockUpdateUserById.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  it("重置密码（有效 token + 新密码）→ 200", async () => {
    const res = await resetPassword(
      makeRequest("/api/auth/reset-password", {
        access_token: "valid-token",
        password: "newpassword123",
      })
    );
    expect(res.status).toBe(200);
    expect(mockUpdateUserById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ password: "newpassword123" })
    );
  });

  it("重置密码（无效/过期 token）→ 401", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });
    const res = await resetPassword(
      makeRequest("/api/auth/reset-password", {
        access_token: "expired-token",
        password: "newpassword123",
      })
    );
    expect(res.status).toBe(401);
  });

  it("重置密码（新密码太短）→ 400", async () => {
    const res = await resetPassword(
      makeRequest("/api/auth/reset-password", {
        access_token: "valid-token",
        password: "123",
      })
    );
    expect(res.status).toBe(400);
  });

  it("重置密码（缺少新密码）→ 400", async () => {
    const res = await resetPassword(
      makeRequest("/api/auth/reset-password", {
        access_token: "valid-token",
      })
    );
    expect(res.status).toBe(400);
  });
});
