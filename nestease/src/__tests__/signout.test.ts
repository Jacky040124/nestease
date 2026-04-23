/**
 * Phase 5: Sign-out behavior
 * 3 test cases — signOut calls Supabase, clears user and session.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";

// ── Hoisted mocks (must be created before vi.mock factory runs) ──
const { mockSignOut, mockGetSession, authState } = vi.hoisted(() => ({
  mockSignOut: vi.fn().mockResolvedValue({ error: null }),
  mockGetSession: vi.fn(),
  authState: { callback: null as null | ((event: string, session: unknown) => void) },
}));

vi.mock("@/lib/supabase-browser", () => ({
  supabaseBrowser: {
    auth: {
      getSession: mockGetSession,
      signInWithPassword: vi.fn(),
      signOut: mockSignOut,
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        authState.callback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  },
}));

import { AuthProvider, useAuth } from "@/contexts/auth-context";

// ── Helpers ───────────────────────────────────────────────────
function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(AuthProvider, null, children);
}

const fakeSession = {
  user: { id: "user-1", email: "pm@test.com" },
  access_token: "token-123",
};

// ── Tests ─────────────────────────────────────────────────────
describe("signOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.callback = null;
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
  });

  it("signOut 调用 supabase.auth.signOut()", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it("signOut 后 user 变为 null", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).not.toBeNull();

    await act(async () => {
      await result.current.signOut();
      // Simulate Supabase firing auth state change after signOut
      authState.callback?.("SIGNED_OUT", null);
    });

    expect(result.current.user).toBeNull();
  });

  it("signOut 后 session 变为 null", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).not.toBeNull();

    await act(async () => {
      await result.current.signOut();
      authState.callback?.("SIGNED_OUT", null);
    });

    expect(result.current.session).toBeNull();
  });
});
