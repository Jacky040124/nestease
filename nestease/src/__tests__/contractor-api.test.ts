/**
 * Contractor Management API — TDD Tests (Phase 1)
 * Tests written BEFORE implementation (red phase).
 *
 * Covers:
 * - GET /api/contractors (list with stats)
 * - GET /api/contractors/[id] (detail)
 * - PATCH /api/contractors/[id] (update)
 * - POST /api/contractors/[id]/rate (rating)
 * - CRUD /api/contractors/[id]/notes (notes)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock data ──────────────────────────────────────────────────

const PM_ID = "pm-001";
const PM_AUTH_ID = "auth-pm-001";
const OTHER_PM_ID = "pm-002";
const OTHER_PM_AUTH_ID = "auth-pm-002";
const CONTRACTOR_ID = "contractor-001";
const CONTRACTOR_2_ID = "contractor-002";
const WORK_ORDER_ID = "wo-001";
const WORK_ORDER_2_ID = "wo-002";

const mockContractor = {
  id: CONTRACTOR_ID,
  name: "刘师傅",
  phone: "+16049981234",
  email: "liu@test.com",
  specialties: ["plumbing"],
  pm_id: PM_ID,
  is_favorite: false,
  auth_id: "auth-contractor-001",
  registered_at: "2026-01-15T00:00:00Z",
  created_at: "2026-01-15T00:00:00Z",
};

const mockContractor2 = {
  id: CONTRACTOR_2_ID,
  name: "黄师傅",
  phone: "+17789975678",
  email: "huang@test.com",
  specialties: ["electrical"],
  pm_id: PM_ID,
  is_favorite: true,
  auth_id: "auth-contractor-002",
  registered_at: "2026-02-01T00:00:00Z",
  created_at: "2026-02-01T00:00:00Z",
};

const mockCompletedWorkOrder = {
  id: WORK_ORDER_ID,
  status: "completed",
  contractor_id: CONTRACTOR_ID,
  pm_id: PM_ID,
  property_address: "3488 Crowley Dr",
  category: "plumbing",
  assigned_at: "2026-04-01T00:00:00Z",
  completed_at: "2026-04-03T00:00:00Z",
};

// ── Hoisted mocks ──────────────────────────────────────────────

const state = vi.hoisted(() => {
  const contractors: Record<string, unknown>[] = [];
  const ratings: Record<string, unknown>[] = [];
  const notes: Record<string, unknown>[] = [];
  const workOrders: Record<string, unknown>[] = [];
  const quotes: Record<string, unknown>[] = [];
  const completionReports: Record<string, unknown>[] = [];
  let currentAuthId = "auth-pm-001";

  return {
    contractors,
    ratings,
    notes,
    workOrders,
    quotes,
    completionReports,
    currentAuthId,
    setAuth: (authId: string) => { currentAuthId = authId; },
    getAuth: () => currentAuthId,
    reset: () => {
      contractors.length = 0;
      ratings.length = 0;
      notes.length = 0;
      workOrders.length = 0;
      quotes.length = 0;
      completionReports.length = 0;
      currentAuthId = "auth-pm-001";
    },
  };
});

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      const tableData: Record<string, Record<string, unknown>[]> = {
        contractor: state.contractors,
        contractor_rating: state.ratings,
        contractor_note: state.notes,
        work_order: state.workOrders,
        quote: state.quotes,
        completion_report: state.completionReports,
      };
      const data = tableData[table] || [];
      const filters: Record<string, unknown> = {};
      let selectFields = "*";
      let pendingInsert: Record<string, unknown> | null = null;
      let pendingUpdate: Record<string, unknown> | null = null;
      let isDelete = false;
      let orderField: string | null = null;
      let orderAsc = true;

      const builder: Record<string, unknown> = {};

      builder.select = (fields?: string) => {
        if (fields) selectFields = fields;
        return builder;
      };
      builder.eq = (field: string, value: unknown) => {
        filters[field] = value;
        return builder;
      };
      builder.in = (field: string, values: unknown[]) => {
        filters[`__in_${field}`] = values;
        return builder;
      };
      builder.order = (field: string, opts?: { ascending?: boolean }) => {
        orderField = field;
        orderAsc = opts?.ascending ?? true;
        return builder;
      };
      builder.limit = () => builder;

      const applyFilters = () => {
        return data.filter((row) =>
          Object.entries(filters).every(([k, v]) => {
            if (k.startsWith("__in_")) {
              return (v as unknown[]).includes(row[k.slice(5)]);
            }
            return row[k] === v;
          })
        );
      };

      builder.single = () => {
        if (pendingInsert) {
          return { data: pendingInsert, error: null };
        }
        if (pendingUpdate) {
          const rows = applyFilters();
          if (rows.length > 0) {
            Object.assign(rows[0], pendingUpdate);
            return { data: { ...rows[0] }, error: null };
          }
          return { data: null, error: { message: "Not found", code: "PGRST116" } };
        }
        const rows = applyFilters();
        return rows.length > 0
          ? { data: { ...rows[0] }, error: null }
          : { data: null, error: { message: "Not found", code: "PGRST116" } };
      };

      builder.then = (resolve: (result: { data: unknown[]; error: null }) => void) => {
        let result = applyFilters();
        if (orderField) {
          result = [...result].sort((a, b) => {
            const aVal = a[orderField!] as string;
            const bVal = b[orderField!] as string;
            return orderAsc ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
          });
        }
        resolve({ data: result, error: null });
      };

      // Make the builder thenable
      Object.defineProperty(builder, "then", {
        value: (resolve: (result: { data: unknown[]; error: null }) => void) => {
          let result = applyFilters();
          if (orderField) {
            result = [...result].sort((a, b) => {
              const aVal = a[orderField!] as string;
              const bVal = b[orderField!] as string;
              return orderAsc ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
            });
          }
          return Promise.resolve({ data: result, error: null }).then(resolve);
        },
        enumerable: false,
      });

      builder.insert = (row: Record<string, unknown>) => {
        const newRow = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...row,
        };
        data.push(newRow);
        pendingInsert = newRow;
        return builder;
      };

      builder.update = (updates: Record<string, unknown>) => {
        pendingUpdate = updates;
        return builder;
      };

      builder.delete = () => {
        isDelete = true;
        const origEq = builder.eq as (f: string, v: unknown) => typeof builder;
        builder.eq = (field: string, value: unknown) => {
          filters[field] = value;
          const toRemove = applyFilters();
          const tableArr = tableData[table];
          if (tableArr) {
            for (const row of toRemove) {
              const idx = tableArr.indexOf(row);
              if (idx >= 0) tableArr.splice(idx, 1);
            }
          }
          return builder;
        };
        return builder;
      };

      return builder;
    }),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: state.getAuth() } },
        error: null,
      })),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getPmId: vi.fn(async (_request?: unknown) => {
    if (state.getAuth() === PM_AUTH_ID) return PM_ID;
    if (state.getAuth() === OTHER_PM_AUTH_ID) return OTHER_PM_ID;
    return null;
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────

function makeRequest(
  url: string,
  method = "GET",
  body?: Record<string, unknown>
): NextRequest {
  const init: RequestInit = { method };
  if (body) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new NextRequest(`http://localhost:3000${url}`, init);
}

// ── Tests ────────────────────────────────────────────────────────

describe("GET /api/contractors", () => {
  beforeEach(() => {
    state.reset();
    state.contractors.push({ ...mockContractor }, { ...mockContractor2 });
  });

  it("returns contractors for the current PM", async () => {
    const { GET } = await import("@/app/api/contractors/route");
    const res = await GET(makeRequest("/api/contractors"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(2);
  });

  it("includes aggregated stats for each contractor", async () => {
    state.workOrders.push({ ...mockCompletedWorkOrder });
    state.ratings.push({
      id: "rating-001",
      work_order_id: WORK_ORDER_ID,
      contractor_id: CONTRACTOR_ID,
      pm_id: PM_ID,
      rating: 4,
      comment: "Good work",
      created_at: "2026-04-03T00:00:00Z",
    });

    const { GET } = await import("@/app/api/contractors/route");
    const res = await GET(makeRequest("/api/contractors"));
    const json = await res.json();

    const contractor = json.data.find((c: { id: string }) => c.id === CONTRACTOR_ID);
    expect(contractor.stats).toBeDefined();
    expect(contractor.stats.total_completed).toBe(1);
    expect(contractor.stats.avg_rating).toBe(4);
  });

  it("does not return other PM's contractors", async () => {
    state.contractors.push({
      id: "contractor-other",
      name: "Other PM's contractor",
      phone: "+1111",
      pm_id: OTHER_PM_ID,
      specialties: [],
      is_favorite: false,
    });

    const { GET } = await import("@/app/api/contractors/route");
    const res = await GET(makeRequest("/api/contractors"));
    const json = await res.json();
    expect(json.data).toHaveLength(2); // Only the current PM's contractors
    expect(json.data.every((c: { pm_id: string }) => c.pm_id === PM_ID)).toBe(true);
  });

  it("supports specialty filter", async () => {
    const { GET } = await import("@/app/api/contractors/route");
    const res = await GET(makeRequest("/api/contractors?specialty=plumbing"));
    const json = await res.json();
    expect(json.data.length).toBeGreaterThanOrEqual(1);
    expect(json.data.every((c: { specialties: string[] }) => c.specialties.includes("plumbing"))).toBe(true);
  });

  it("favorites are sorted first", async () => {
    const { GET } = await import("@/app/api/contractors/route");
    const res = await GET(makeRequest("/api/contractors"));
    const json = await res.json();
    // mockContractor2 is favorite, should be first
    expect(json.data[0].is_favorite).toBe(true);
  });

  it("returns empty stats for contractor with no completed work orders", async () => {
    const { GET } = await import("@/app/api/contractors/route");
    const res = await GET(makeRequest("/api/contractors"));
    const json = await res.json();
    const contractor = json.data.find((c: { id: string }) => c.id === CONTRACTOR_2_ID);
    expect(contractor.stats.total_completed).toBe(0);
    expect(contractor.stats.avg_rating).toBeNull();
  });
});

describe("GET /api/contractors/[id]", () => {
  beforeEach(() => {
    state.reset();
    state.contractors.push({ ...mockContractor });
    state.workOrders.push({ ...mockCompletedWorkOrder });
  });

  it("returns contractor detail with history", async () => {
    const { GET } = await import("@/app/api/contractors/[id]/route");
    const res = await GET(makeRequest(`/api/contractors/${CONTRACTOR_ID}`), {
      params: Promise.resolve({ id: CONTRACTOR_ID }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe(CONTRACTOR_ID);
    expect(json.data.stats).toBeDefined();
    expect(json.data.work_orders).toBeDefined();
  });

  it("returns 404 for non-existent contractor", async () => {
    const { GET } = await import("@/app/api/contractors/[id]/route");
    const res = await GET(makeRequest("/api/contractors/nonexistent"), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 for other PM's contractor", async () => {
    state.contractors.push({
      id: "contractor-other",
      name: "Other",
      phone: "+1111",
      pm_id: OTHER_PM_ID,
      specialties: [],
      is_favorite: false,
    });

    const { GET } = await import("@/app/api/contractors/[id]/route");
    const res = await GET(makeRequest("/api/contractors/contractor-other"), {
      params: Promise.resolve({ id: "contractor-other" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/contractors/[id]", () => {
  beforeEach(() => {
    state.reset();
    state.contractors.push({ ...mockContractor });
  });

  it("updates is_favorite", async () => {
    const { PATCH } = await import("@/app/api/contractors/[id]/route");
    const res = await PATCH(
      makeRequest(`/api/contractors/${CONTRACTOR_ID}`, "PATCH", { is_favorite: true }),
      { params: Promise.resolve({ id: CONTRACTOR_ID }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.is_favorite).toBe(true);
  });

  it("updates basic info", async () => {
    const { PATCH } = await import("@/app/api/contractors/[id]/route");
    const res = await PATCH(
      makeRequest(`/api/contractors/${CONTRACTOR_ID}`, "PATCH", {
        name: "刘师傅更新",
        phone: "+16049981111",
      }),
      { params: Promise.resolve({ id: CONTRACTOR_ID }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.name).toBe("刘师傅更新");
  });

  it("returns 403 for other PM's contractor", async () => {
    state.contractors.push({
      id: "contractor-other",
      name: "Other",
      phone: "+1111",
      pm_id: OTHER_PM_ID,
      specialties: [],
      is_favorite: false,
    });

    const { PATCH } = await import("@/app/api/contractors/[id]/route");
    const res = await PATCH(
      makeRequest("/api/contractors/contractor-other", "PATCH", { is_favorite: true }),
      { params: Promise.resolve({ id: "contractor-other" }) }
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/contractors/[id]/rate", () => {
  beforeEach(() => {
    state.reset();
    state.contractors.push({ ...mockContractor });
    state.workOrders.push({ ...mockCompletedWorkOrder });
  });

  it("creates a rating for a completed work order", async () => {
    const { POST } = await import("@/app/api/contractors/[id]/rate/route");
    const res = await POST(
      makeRequest(`/api/contractors/${CONTRACTOR_ID}/rate`, "POST", {
        work_order_id: WORK_ORDER_ID,
        rating: 5,
        comment: "Excellent work",
      }),
      { params: Promise.resolve({ id: CONTRACTOR_ID }) }
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.rating).toBe(5);
    expect(json.data.comment).toBe("Excellent work");
  });

  it("rejects rating outside 1-5 range", async () => {
    const { POST } = await import("@/app/api/contractors/[id]/rate/route");

    const res0 = await POST(
      makeRequest(`/api/contractors/${CONTRACTOR_ID}/rate`, "POST", {
        work_order_id: WORK_ORDER_ID,
        rating: 0,
      }),
      { params: Promise.resolve({ id: CONTRACTOR_ID }) }
    );
    expect(res0.status).toBe(422);

    const res6 = await POST(
      makeRequest(`/api/contractors/${CONTRACTOR_ID}/rate`, "POST", {
        work_order_id: WORK_ORDER_ID,
        rating: 6,
      }),
      { params: Promise.resolve({ id: CONTRACTOR_ID }) }
    );
    expect(res6.status).toBe(422);
  });

  it("rejects duplicate rating for same work order", async () => {
    state.ratings.push({
      id: "existing-rating",
      work_order_id: WORK_ORDER_ID,
      contractor_id: CONTRACTOR_ID,
      pm_id: PM_ID,
      rating: 4,
      created_at: "2026-04-03T00:00:00Z",
    });

    const { POST } = await import("@/app/api/contractors/[id]/rate/route");
    const res = await POST(
      makeRequest(`/api/contractors/${CONTRACTOR_ID}/rate`, "POST", {
        work_order_id: WORK_ORDER_ID,
        rating: 5,
      }),
      { params: Promise.resolve({ id: CONTRACTOR_ID }) }
    );
    expect(res.status).toBe(409);
  });

  it("rejects rating for non-existent work order", async () => {
    const { POST } = await import("@/app/api/contractors/[id]/rate/route");
    const res = await POST(
      makeRequest(`/api/contractors/${CONTRACTOR_ID}/rate`, "POST", {
        work_order_id: "nonexistent",
        rating: 4,
      }),
      { params: Promise.resolve({ id: CONTRACTOR_ID }) }
    );
    expect(res.status).toBe(404);
  });

  it("rejects rating for work order not belonging to current PM", async () => {
    state.workOrders.push({
      id: "wo-other-pm",
      status: "completed",
      contractor_id: CONTRACTOR_ID,
      pm_id: OTHER_PM_ID,
    });

    const { POST } = await import("@/app/api/contractors/[id]/rate/route");
    const res = await POST(
      makeRequest(`/api/contractors/${CONTRACTOR_ID}/rate`, "POST", {
        work_order_id: "wo-other-pm",
        rating: 4,
      }),
      { params: Promise.resolve({ id: CONTRACTOR_ID }) }
    );
    expect(res.status).toBe(403);
  });

  it("rejects rating when contractor_id doesn't match work order", async () => {
    const { POST } = await import("@/app/api/contractors/[id]/rate/route");
    const res = await POST(
      makeRequest(`/api/contractors/${CONTRACTOR_2_ID}/rate`, "POST", {
        work_order_id: WORK_ORDER_ID, // assigned to CONTRACTOR_ID, not CONTRACTOR_2_ID
        rating: 4,
      }),
      { params: Promise.resolve({ id: CONTRACTOR_2_ID }) }
    );
    expect(res.status).toBe(422);
  });
});

describe("CRUD /api/contractors/[id]/notes", () => {
  beforeEach(() => {
    state.reset();
    state.contractors.push({ ...mockContractor });
  });

  it("creates a note", async () => {
    const { POST } = await import("@/app/api/contractors/[id]/notes/route");
    const res = await POST(
      makeRequest(`/api/contractors/${CONTRACTOR_ID}/notes`, "POST", {
        content: "张师傅周末不接活",
      }),
      { params: Promise.resolve({ id: CONTRACTOR_ID }) }
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.content).toBe("张师傅周末不接活");
  });

  it("rejects empty content", async () => {
    const { POST } = await import("@/app/api/contractors/[id]/notes/route");
    const res = await POST(
      makeRequest(`/api/contractors/${CONTRACTOR_ID}/notes`, "POST", {
        content: "",
      }),
      { params: Promise.resolve({ id: CONTRACTOR_ID }) }
    );
    expect(res.status).toBe(422);
  });

  it("lists notes in reverse chronological order", async () => {
    state.notes.push(
      {
        id: "note-1",
        contractor_id: CONTRACTOR_ID,
        pm_id: PM_ID,
        content: "First note",
        created_at: "2026-04-01T00:00:00Z",
        updated_at: "2026-04-01T00:00:00Z",
      },
      {
        id: "note-2",
        contractor_id: CONTRACTOR_ID,
        pm_id: PM_ID,
        content: "Second note",
        created_at: "2026-04-02T00:00:00Z",
        updated_at: "2026-04-02T00:00:00Z",
      }
    );

    const { GET } = await import("@/app/api/contractors/[id]/notes/route");
    const res = await GET(
      makeRequest(`/api/contractors/${CONTRACTOR_ID}/notes`),
      { params: Promise.resolve({ id: CONTRACTOR_ID }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(2);
    // Most recent first
    expect(json.data[0].content).toBe("Second note");
  });

  it("updates a note", async () => {
    state.notes.push({
      id: "note-1",
      contractor_id: CONTRACTOR_ID,
      pm_id: PM_ID,
      content: "Old content",
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
    });

    const { PATCH } = await import("@/app/api/contractors/[id]/notes/[noteId]/route");
    const res = await PATCH(
      makeRequest(`/api/contractors/${CONTRACTOR_ID}/notes/note-1`, "PATCH", {
        content: "Updated content",
      }),
      { params: Promise.resolve({ id: CONTRACTOR_ID, noteId: "note-1" }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.content).toBe("Updated content");
  });

  it("deletes a note", async () => {
    state.notes.push({
      id: "note-1",
      contractor_id: CONTRACTOR_ID,
      pm_id: PM_ID,
      content: "To delete",
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
    });

    const { DELETE } = await import("@/app/api/contractors/[id]/notes/[noteId]/route");
    const res = await DELETE(
      makeRequest(`/api/contractors/${CONTRACTOR_ID}/notes/note-1`, "DELETE"),
      { params: Promise.resolve({ id: CONTRACTOR_ID, noteId: "note-1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("rejects note operations on other PM's contractor", async () => {
    state.contractors.push({
      id: "contractor-other",
      name: "Other",
      phone: "+1111",
      pm_id: OTHER_PM_ID,
      specialties: [],
      is_favorite: false,
    });

    const { POST } = await import("@/app/api/contractors/[id]/notes/route");
    const res = await POST(
      makeRequest("/api/contractors/contractor-other/notes", "POST", {
        content: "Should fail",
      }),
      { params: Promise.resolve({ id: "contractor-other" }) }
    );
    expect(res.status).toBe(403);
  });
});
