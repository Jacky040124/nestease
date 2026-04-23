import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock supabaseAdmin
const mockInsert = vi.fn();
const mockSelectAfterInsert = vi.fn();
const mockSingleAfterInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEqAfterUpdate = vi.fn();
const mockSelectQuery = vi.fn();
const mockEqQuery = vi.fn();
const mockSingleQuery = vi.fn();
const mockMaybeSingleQuery = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

// Mock notification dispatch
vi.mock("@/lib/send-notification", () => ({
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notification-messages", () => ({
  getNotificationMessage: vi.fn().mockReturnValue("New work order notification"),
}));

// Mock token generation (still used for status token)
vi.mock("@/lib/token", () => ({
  generateToken: vi.fn().mockReturnValue("mock-status-token"),
}));

const propertyData = {
  address: "5380 Crooked Branch Road",
  unit: "1208",
  owner_id: "owner-1",
  pm_id: "pm-1",
};

const workOrderData = {
  id: "wo-123",
  status: "pending_assignment",
  property_id: "prop-1",
};

function setupMocks() {
  mockFrom.mockImplementation((table: string) => {
    if (table === "property") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: propertyData, error: null }),
          }),
        }),
      };
    }
    if (table === "tenant") {
      return {
        select: () => ({
          eq: (_col: string, _val: string) => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: "tenant-new", name: "张三", phone: "+1234" }, error: null }),
          }),
        }),
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      };
    }
    if (table === "work_order") {
      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: workOrderData, error: null }),
          }),
        }),
      };
    }
    if (table === "work_order_status_history") {
      return {
        insert: () => Promise.resolve({ error: null }),
      };
    }
    if (table === "notification") {
      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: "notif-1" }, error: null }),
          }),
        }),
      };
    }
    return {};
  });
}

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL("http://localhost/api/public/work-orders"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Import after mocks
const routeModule = await import("@/app/api/public/work-orders/route");

describe("POST /api/public/work-orders (no token auth)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("returns 400 when property_id is missing", async () => {
    const req = makeRequest({
      category: "plumbing",
      description: "Water leak in kitchen",
      name: "张三",
      phone: "+1234",
    });
    const res = await routeModule.POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when category is missing", async () => {
    const req = makeRequest({
      property_id: "prop-1",
      description: "Water leak",
      name: "张三",
      phone: "+1234",
    });
    const res = await routeModule.POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when description is missing", async () => {
    const req = makeRequest({
      property_id: "prop-1",
      category: "plumbing",
      name: "张三",
      phone: "+1234",
    });
    const res = await routeModule.POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid category", async () => {
    const req = makeRequest({
      property_id: "prop-1",
      category: "invalid_category",
      description: "Water leak",
      name: "张三",
      phone: "+1234",
    });
    const res = await routeModule.POST(req);
    expect(res.status).toBe(400);
  });

  it("creates work order successfully without any token", async () => {
    const req = makeRequest({
      property_id: "prop-1",
      category: "plumbing",
      description: "Water leak in kitchen",
      name: "张三",
      phone: "+1234567890",
    });
    const res = await routeModule.POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("wo-123");
    expect(body.statusToken).toBe("mock-status-token");
  });

  it("returns 422 when name/phone missing and no existing tenant", async () => {
    const req = makeRequest({
      property_id: "prop-1",
      category: "plumbing",
      description: "Water leak in kitchen",
    });
    const res = await routeModule.POST(req);
    expect(res.status).toBe(422);
  });

  it("returns 404 when property not found", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "property") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: { message: "not found" } }),
            }),
          }),
        };
      }
      return {};
    });

    const req = makeRequest({
      property_id: "nonexistent",
      category: "plumbing",
      description: "Water leak",
      name: "张三",
      phone: "+1234",
    });
    const res = await routeModule.POST(req);
    expect(res.status).toBe(404);
  });
});
