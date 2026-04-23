import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock supabaseAdmin
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
}));
mockSelect.mockReturnValue({ eq: mockEq });
mockEq.mockReturnValue({ single: mockSingle });

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

// Import the route handler after mocking
const { GET } = await import("@/app/api/public/property-by-code/route");

function makeRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"));
}

describe("GET /api/public/property-by-code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it("returns 400 when code is missing", async () => {
    const req = makeRequest("http://localhost/api/public/property-by-code");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("code");
  });

  it("returns 404 when property not found by code", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "not found" } });

    const req = makeRequest("http://localhost/api/public/property-by-code?code=A3K7P2");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns property data when code matches", async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: "prop-123",
        address: "5380 Crooked Branch Road",
        unit: "1208",
        pm_id: "pm-1",
      },
      error: null,
    });

    const req = makeRequest("http://localhost/api/public/property-by-code?code=A3K7P2");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("prop-123");
    expect(body.address).toBe("5380 Crooked Branch Road");
    expect(body.unit).toBe("1208");
  });

  it("normalizes code to uppercase", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "prop-123", address: "123 Main St", unit: null, pm_id: "pm-1" },
      error: null,
    });

    const req = makeRequest("http://localhost/api/public/property-by-code?code=a3k7p2");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockEq).toHaveBeenCalledWith("repair_code", "A3K7P2");
  });
});
