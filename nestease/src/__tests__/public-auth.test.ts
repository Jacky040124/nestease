import { describe, it, expect, vi } from "vitest";

// Mock the token module before importing public-auth
vi.mock("@/lib/token", () => ({
  verifyToken: vi.fn(),
}));

import { getPublicAuth, publicUnauthorizedResponse } from "@/lib/public-auth";
import { verifyToken } from "@/lib/token";
import { NextRequest } from "next/server";

const mockVerifyToken = vi.mocked(verifyToken);

function makeRequest(url: string, headers?: Record<string, string>): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"), { headers });
}

describe("Public Auth — getPublicAuth", () => {
  it("extracts token from query param and verifies", () => {
    mockVerifyToken.mockReturnValue({
      workOrderId: "wo-1",
      role: "contractor",
      actorId: "c-1",
    });

    const req = makeRequest("http://localhost/api?token=valid-token");
    const result = getPublicAuth(req);

    expect(mockVerifyToken).toHaveBeenCalledWith("valid-token");
    expect(result).toEqual({
      workOrderId: "wo-1",
      role: "contractor",
      actorId: "c-1",
    });
  });

  it("extracts token from x-access-token header when query param missing", () => {
    mockVerifyToken.mockReturnValue({
      workOrderId: "wo-2",
      role: "tenant",
      actorId: "t-1",
    });

    const req = makeRequest("http://localhost/api", {
      "x-access-token": "header-token",
    });
    const result = getPublicAuth(req);

    expect(mockVerifyToken).toHaveBeenCalledWith("header-token");
    expect(result).toEqual({
      workOrderId: "wo-2",
      role: "tenant",
      actorId: "t-1",
    });
  });

  it("prefers query param over header", () => {
    mockVerifyToken.mockReturnValue({
      workOrderId: "wo-3",
      role: "owner",
      actorId: "o-1",
    });

    const req = makeRequest("http://localhost/api?token=query-token", {
      "x-access-token": "header-token",
    });
    getPublicAuth(req);

    expect(mockVerifyToken).toHaveBeenCalledWith("query-token");
  });

  it("returns null when no token is provided", () => {
    const req = makeRequest("http://localhost/api");
    const result = getPublicAuth(req);
    expect(result).toBeNull();
  });

  it("returns null when token verification fails", () => {
    mockVerifyToken.mockReturnValue(null);

    const req = makeRequest("http://localhost/api?token=bad-token");
    const result = getPublicAuth(req);
    expect(result).toBeNull();
  });
});

describe("Public Auth — publicUnauthorizedResponse", () => {
  it("returns 401 with error message", async () => {
    const res = publicUnauthorizedResponse();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid or expired link");
  });
});
