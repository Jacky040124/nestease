/**
 * Phase 4: Session expiry — 401 interception in api.ts
 * 5 test cases — 401 triggers signOut + redirect, other statuses don't.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────
const { mockSignOut, mockGetSession, mockFetch } = vi.hoisted(() => ({
  mockSignOut: vi.fn().mockResolvedValue({ error: null }),
  mockGetSession: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/supabase-browser", () => ({
  supabaseBrowser: {
    auth: {
      getSession: mockGetSession,
      signOut: mockSignOut,
    },
  },
}));

// Replace global fetch
vi.stubGlobal("fetch", mockFetch);

import { api } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────
function mockFetchResponse(status: number, body: Record<string, unknown> = {}) {
  mockFetch.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

// ── Tests ─────────────────────────────────────────────────────
describe("API 401 interception", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "token-123" } },
    });
    // Reset window.location for redirect tests
    Object.defineProperty(window, "location", {
      value: { href: "http://localhost:3000/dashboard" },
      writable: true,
    });
  });

  it("API 返回 401 → 触发 signOut", async () => {
    mockFetchResponse(401, { error: "Unauthorized" });

    await expect(api.getWorkOrder("wo-1")).rejects.toThrow();
    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it("API 返回 401 → redirect /login", async () => {
    mockFetchResponse(401, { error: "Unauthorized" });

    await expect(api.getWorkOrder("wo-1")).rejects.toThrow();
    expect(window.location.href).toContain("/login");
  });

  it("API 返回 200 → 不触发 signOut", async () => {
    mockFetchResponse(200, { data: { id: "wo-1" } });

    await api.getWorkOrder("wo-1");
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("API 返回 403 → 不触发 signOut", async () => {
    mockFetchResponse(403, { error: "Forbidden" });

    await expect(api.getWorkOrder("wo-1")).rejects.toThrow();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("API 返回 500 → 不触发 signOut", async () => {
    mockFetchResponse(500, { error: "Server error" });

    await expect(api.getWorkOrder("wo-1")).rejects.toThrow();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
