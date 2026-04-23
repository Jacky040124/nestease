/**
 * Phase 1: middleware.ts route protection
 * 12 test cases — protected routes require auth, public routes pass through.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock Supabase SSR ─────────────────────────────────────────
const mockGetUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

import { middleware } from "@/middleware";

// ── Helpers ───────────────────────────────────────────────────
function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

const fakeUser = { id: "user-1", email: "pm@test.com" };

// ── Tests ─────────────────────────────────────────────────────
describe("middleware route protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Protected routes: not logged in → redirect /login ──────
  it("未登录访问 /dashboard → redirect /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await middleware(makeRequest("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("未登录访问 /dashboard/work-orders/xxx → redirect /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await middleware(makeRequest("/dashboard/work-orders/wo-123"));
    expect(res.headers.get("location")).toContain("/login");
  });

  // ── Protected routes: logged in → pass through ─────────────
  it("已登录访问 /dashboard → 放行", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null });
    const res = await middleware(makeRequest("/dashboard"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  // ── Login page: logged in → redirect to dashboard ──────────
  it("已登录访问 /login → redirect /dashboard", async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null });
    const res = await middleware(makeRequest("/login"));
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  // ── Login page: not logged in → pass through ───────────────
  it("未登录访问 /login → 放行", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await middleware(makeRequest("/login"));
    expect(res.headers.get("location")).toBeNull();
  });

  // ── Public routes: always pass through ─────────────────────
  it("公开路由 / → 放行", async () => {
    const res = await middleware(makeRequest("/"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("公开路由 /repair → 放行", async () => {
    const res = await middleware(makeRequest("/repair"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("公开路由 /status → 放行", async () => {
    const res = await middleware(makeRequest("/status"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("公开路由 /approve → 放行", async () => {
    const res = await middleware(makeRequest("/approve"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("公开路由 /api/public/work-orders → 放行", async () => {
    const res = await middleware(makeRequest("/api/public/work-orders/wo-1/transition"));
    expect(res.headers.get("location")).toBeNull();
  });

  // ── Static assets ──────────────────────────────────────────
  it("静态资源 /_next/static/... → 放行", async () => {
    const res = await middleware(makeRequest("/_next/static/chunks/main.js"));
    expect(res.headers.get("location")).toBeNull();
  });

  // ── Expired session ────────────────────────────────────────
  it("session 过期访问 /dashboard → redirect /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "JWT expired" } });
    const res = await middleware(makeRequest("/dashboard"));
    expect(res.headers.get("location")).toContain("/login");
  });
});
