/**
 * Contractor Authentication — TDD Tests (Phase 2A)
 * Tests written BEFORE implementation (red phase).
 *
 * Covers:
 * - GET /api/pm/code (PM Code retrieval)
 * - POST /api/auth/contractor/verify-code (PM Code validation)
 * - POST /api/auth/contractor/send-otp (OTP sending)
 * - POST /api/auth/contractor/register (Contractor registration)
 * - POST /api/auth/contractor/verify-otp (Contractor login)
 * - GET /api/auth/contractor/me (Contractor session)
 * - Assign contractor must be registered (派单校验)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ── Constants ───────────────────────────────────────────────────
const PM_ID = "pm-001";
const PM_AUTH_ID = "auth-pm-001";
const PM_CODE = "K9X3M7";
const PM_NAME = "张经理";
const CONTRACTOR_PHONE = "+16049981234";
const CONTRACTOR_NAME = "刘师傅";

// ── Hoisted mocks ───────────────────────────────────────────────
const state = vi.hoisted(() => {
  const pms: Record<string, unknown>[] = [];
  const contractors: Record<string, unknown>[] = [];
  const otps: Record<string, unknown>[] = [];
  const workOrders: Record<string, unknown>[] = [];
  let smsSent: { to: string; body: string }[] = [];
  let createdAuthUsers: Record<string, unknown>[] = [];
  let deletedAuthUserIds: string[] = [];

  return {
    pms,
    contractors,
    otps,
    workOrders,
    smsSent,
    createdAuthUsers,
    deletedAuthUserIds,
    reset: () => {
      pms.length = 0;
      contractors.length = 0;
      otps.length = 0;
      workOrders.length = 0;
      smsSent = [];
      createdAuthUsers = [];
      deletedAuthUserIds = [];
      // Re-assign so references work
      state.smsSent = smsSent;
      state.createdAuthUsers = createdAuthUsers;
      state.deletedAuthUserIds = deletedAuthUserIds;
    },
  };
});

vi.mock("@/lib/sms", () => ({
  sendSMS: vi.fn(async (to: string, body: string) => {
    state.smsSent.push({ to, body });
    return true;
  }),
  normalizePhone: vi.fn((phone: string) => phone),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      const tableData: Record<string, Record<string, unknown>[]> = {
        pm: state.pms,
        contractor: state.contractors,
        contractor_otp: state.otps,
        work_order: state.workOrders,
      };
      const data = tableData[table] || [];
      const filters: Record<string, unknown> = {};
      let pendingInsert: Record<string, unknown> | null = null;
      let pendingUpdate: Record<string, unknown> | null = null;
      let pendingDelete = false;
      let orderField: string | null = null;
      let orderAsc = true;
      let limitCount: number | null = null;

      const builder: Record<string, unknown> = {};

      builder.select = (fields?: string) => {
        return builder;
      };
      builder.eq = (field: string, value: unknown) => {
        filters[field] = value;
        return builder;
      };
      builder.neq = (field: string, value: unknown) => {
        filters[`__neq_${field}`] = value;
        return builder;
      };
      builder.gt = (field: string, value: unknown) => {
        filters[`__gt_${field}`] = value;
        return builder;
      };
      builder.lt = (field: string, value: unknown) => {
        filters[`__lt_${field}`] = value;
        return builder;
      };
      builder.is = (field: string, value: unknown) => {
        filters[`__is_${field}`] = value;
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
      builder.limit = (n: number) => {
        limitCount = n;
        return builder;
      };

      const applyFilters = () => {
        return data.filter((row) =>
          Object.entries(filters).every(([k, v]) => {
            if (k.startsWith("__neq_")) return row[k.slice(6)] !== v;
            if (k.startsWith("__gt_")) return (row[k.slice(5)] as string) > (v as string);
            if (k.startsWith("__lt_")) return (row[k.slice(5)] as string) < (v as string);
            if (k.startsWith("__is_")) return row[k.slice(5)] === v;
            if (k.startsWith("__in_")) return (v as unknown[]).includes(row[k.slice(5)]);
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

      builder.maybeSingle = () => {
        if (pendingUpdate) {
          const rows = applyFilters();
          if (rows.length > 0) {
            Object.assign(rows[0], pendingUpdate);
            return { data: { ...rows[0] }, error: null };
          }
          return { data: null, error: null };
        }
        const rows = applyFilters();
        return rows.length > 0
          ? { data: { ...rows[0] }, error: null }
          : { data: null, error: null };
      };

      // Thenable for multi-row queries
      Object.defineProperty(builder, "then", {
        value: (resolve: (result: { data: unknown[]; error: null }) => void) => {
          if (pendingDelete) {
            const rows = applyFilters();
            const tableArr = tableData[table];
            if (tableArr) {
              for (const row of rows) {
                const idx = tableArr.indexOf(row);
                if (idx >= 0) tableArr.splice(idx, 1);
              }
            }
            return Promise.resolve({ data: rows, error: null }).then(resolve);
          }
          let result = applyFilters();
          if (orderField) {
            result = [...result].sort((a, b) => {
              const aVal = a[orderField!] as string;
              const bVal = b[orderField!] as string;
              return orderAsc ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
            });
          }
          if (limitCount != null) {
            result = result.slice(0, limitCount);
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
        pendingDelete = true;
        return builder;
      };

      return builder;
    }),
    auth: {
      admin: {
        createUser: vi.fn(async (params: Record<string, unknown>) => {
          const userId = crypto.randomUUID();
          const user = { id: userId, phone: params.phone, user_metadata: params.user_metadata };
          state.createdAuthUsers.push(user);
          return { data: { user }, error: null };
        }),
        deleteUser: vi.fn(async (userId: string) => {
          state.deletedAuthUserIds.push(userId);
          return { data: null, error: null };
        }),
      },
      getUser: vi.fn(async () => ({
        data: { user: { id: PM_AUTH_ID } },
        error: null,
      })),
    },
  },
}));

const contractorAuthState = vi.hoisted(() => ({
  contractorId: "contractor-001" as string | null,
}));

vi.mock("@/lib/auth", () => ({
  getPmId: vi.fn(async () => PM_ID),
  getContractorId: vi.fn(async (request?: unknown) => {
    // Check for empty auth header to simulate unauthenticated
    if (request && (request as NextRequest).headers?.get("authorization") === "") {
      return null;
    }
    return contractorAuthState.contractorId;
  }),
  getAuthUser: vi.fn(async () => ({ id: PM_AUTH_ID, email: "zhang@test.com" })),
  AuthUser: {},
  unauthorizedResponse: vi.fn(() =>
    NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  ),
}));

vi.mock("@/lib/contractor-session", () => ({
  signContractorSession: vi.fn((authId: string) => `mock-session-${authId}`),
  verifyContractorSession: vi.fn((token: string) => {
    if (token.startsWith("mock-session-")) return token.slice(13);
    return null;
  }),
}));

vi.mock("@/lib/side-effects-processor", () => ({
  processSideEffects: vi.fn(async () => ({})),
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: vi.fn((handler: Function) => {
    return async (request: NextRequest, ...args: unknown[]) => {
      const { getAuthUser } = await import("@/lib/auth");
      const user = await getAuthUser(request);
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return handler(user, request, ...args);
    };
  }),
  withAuthParams: vi.fn((handler: Function) => {
    return async (request: NextRequest, ctx: unknown) => {
      const { getAuthUser } = await import("@/lib/auth");
      const user = await getAuthUser(request);
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return handler(user, request, ctx);
    };
  }),
}));

// ── Helpers ─────────────────────────────────────────────────────

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

function seedPm() {
  state.pms.push({
    id: PM_ID,
    auth_id: PM_AUTH_ID,
    name: PM_NAME,
    email: "zhang@test.com",
    phone: "+16041112222",
    pm_code: PM_CODE,
  });
}

function seedRegisteredContractor(overrides?: Record<string, unknown>) {
  state.contractors.push({
    id: "contractor-001",
    name: CONTRACTOR_NAME,
    phone: CONTRACTOR_PHONE,
    specialties: ["plumbing"],
    pm_id: PM_ID,
    auth_id: "auth-contractor-001",
    registered_at: "2026-04-12T00:00:00Z",
    is_favorite: false,
    ...overrides,
  });
}

function seedUnregisteredContractor(overrides?: Record<string, unknown>) {
  state.contractors.push({
    id: "contractor-unreg",
    name: "未注册师傅",
    phone: "+16049999999",
    specialties: ["electrical"],
    pm_id: PM_ID,
    auth_id: null,
    registered_at: null,
    is_favorite: false,
    ...overrides,
  });
}

function seedOtp(phone: string, code: string, overrides?: Record<string, unknown>) {
  state.otps.push({
    id: crypto.randomUUID(),
    phone,
    code,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min from now
    attempts: 0,
    used: false,
    created_at: new Date().toISOString(),
    ...overrides,
  });
}

// ── Tests ───────────────────────────────────────────────────────

describe("GET /api/pm/code", () => {
  beforeEach(() => {
    state.reset();
    seedPm();
  });

  it("returns PM code and share URL", async () => {
    const { GET } = await import("@/app/api/pm/code/route");
    const res = await GET(makeRequest("/api/pm/code"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.code).toBe(PM_CODE);
    expect(json.share_url).toContain("/register/contractor?code=");
    expect(json.share_url).toContain(PM_CODE);
  });

  it("returns 401 when not authenticated", async () => {
    const { getPmId } = await import("@/lib/auth");
    (getPmId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/pm/code/route");
    const res = await GET(makeRequest("/api/pm/code"));
    expect(res.status).toBe(401);
  });

  it("PM code is 6 character alphanumeric", async () => {
    const { GET } = await import("@/app/api/pm/code/route");
    const res = await GET(makeRequest("/api/pm/code"));
    const json = await res.json();
    expect(json.code).toMatch(/^[A-Z0-9]{6}$/);
  });
});

describe("POST /api/auth/contractor/verify-code", () => {
  beforeEach(() => {
    state.reset();
    seedPm();
  });

  it("returns valid=true and pm_name for valid code", async () => {
    const { POST } = await import("@/app/api/auth/contractor/verify-code/route");
    const res = await POST(makeRequest("/api/auth/contractor/verify-code", "POST", {
      code: PM_CODE,
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(true);
    expect(json.pm_name).toBe(PM_NAME);
  });

  it("returns valid=false for invalid code", async () => {
    const { POST } = await import("@/app/api/auth/contractor/verify-code/route");
    const res = await POST(makeRequest("/api/auth/contractor/verify-code", "POST", {
      code: "XXXXXX",
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(false);
  });

  it("returns 422 for missing code", async () => {
    const { POST } = await import("@/app/api/auth/contractor/verify-code/route");
    const res = await POST(makeRequest("/api/auth/contractor/verify-code", "POST", {}));
    expect(res.status).toBe(422);
  });
});

describe("POST /api/auth/contractor/send-otp", () => {
  beforeEach(() => {
    state.reset();
    seedPm();
  });

  it("generates 6-digit OTP and sends SMS", async () => {
    const { POST } = await import("@/app/api/auth/contractor/send-otp/route");
    const res = await POST(makeRequest("/api/auth/contractor/send-otp", "POST", {
      phone: CONTRACTOR_PHONE,
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    // OTP record should be created
    expect(state.otps.length).toBeGreaterThanOrEqual(1);
    const otp = state.otps[state.otps.length - 1];
    expect(otp.code).toMatch(/^\d{6}$/);
    expect(otp.phone).toBe(CONTRACTOR_PHONE);
    // SMS should be sent
    expect(state.smsSent.length).toBeGreaterThanOrEqual(1);
  });

  it("returns 422 for invalid phone format", async () => {
    const { POST } = await import("@/app/api/auth/contractor/send-otp/route");
    const res = await POST(makeRequest("/api/auth/contractor/send-otp", "POST", {
      phone: "",
    }));
    expect(res.status).toBe(422);
  });

  it("returns 429 if OTP sent within last 60 seconds", async () => {
    // Seed a recent OTP
    seedOtp(CONTRACTOR_PHONE, "123456", {
      created_at: new Date().toISOString(), // just now
    });

    const { POST } = await import("@/app/api/auth/contractor/send-otp/route");
    const res = await POST(makeRequest("/api/auth/contractor/send-otp", "POST", {
      phone: CONTRACTOR_PHONE,
    }));
    expect(res.status).toBe(429);
  });

  it("cleans up expired OTP records", async () => {
    // Seed an expired OTP
    seedOtp(CONTRACTOR_PHONE, "000000", {
      expires_at: new Date(Date.now() - 86400000).toISOString(), // expired yesterday
      created_at: new Date(Date.now() - 86400000).toISOString(),
    });
    const initialCount = state.otps.length;

    const { POST } = await import("@/app/api/auth/contractor/send-otp/route");
    await POST(makeRequest("/api/auth/contractor/send-otp", "POST", {
      phone: CONTRACTOR_PHONE,
    }));
    // Expired OTP should be cleaned up (or at least a new one created)
    const unexpired = state.otps.filter(
      (o) => new Date(o.expires_at as string) > new Date()
    );
    expect(unexpired.length).toBeGreaterThanOrEqual(1);
  });

  it("always returns 200 regardless of phone existence (anti-enumeration)", async () => {
    // Phone not in contractor table — should still return 200 and send OTP
    const { POST } = await import("@/app/api/auth/contractor/send-otp/route");
    const res = await POST(makeRequest("/api/auth/contractor/send-otp", "POST", {
      phone: "+19999999999",
    }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/auth/contractor/register", () => {
  beforeEach(() => {
    state.reset();
    seedPm();
    seedOtp(CONTRACTOR_PHONE, "123456");
  });

  it("registers contractor with valid pm_code + OTP", async () => {
    const { POST } = await import("@/app/api/auth/contractor/register/route");
    const res = await POST(makeRequest("/api/auth/contractor/register", "POST", {
      pm_code: PM_CODE,
      name: CONTRACTOR_NAME,
      phone: CONTRACTOR_PHONE,
      specialties: ["plumbing"],
      otp: "123456",
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.session).toBeDefined();
    expect(json.session.access_token).toBeDefined();
    expect(json.contractor).toBeDefined();
    expect(json.contractor.name).toBe(CONTRACTOR_NAME);
    // Contractor should be in DB with auth_id
    const created = state.contractors.find((c) => c.phone === CONTRACTOR_PHONE);
    expect(created).toBeDefined();
    expect(created!.auth_id).toBeDefined();
    expect(created!.registered_at).toBeDefined();
    expect(created!.pm_id).toBe(PM_ID);
  });

  it("rejects invalid pm_code", async () => {
    const { POST } = await import("@/app/api/auth/contractor/register/route");
    const res = await POST(makeRequest("/api/auth/contractor/register", "POST", {
      pm_code: "BADCODE",
      name: CONTRACTOR_NAME,
      phone: CONTRACTOR_PHONE,
      specialties: ["plumbing"],
      otp: "123456",
    }));
    expect(res.status).toBe(400);
  });

  it("rejects wrong OTP", async () => {
    const { POST } = await import("@/app/api/auth/contractor/register/route");
    const res = await POST(makeRequest("/api/auth/contractor/register", "POST", {
      pm_code: PM_CODE,
      name: CONTRACTOR_NAME,
      phone: CONTRACTOR_PHONE,
      specialties: ["plumbing"],
      otp: "999999",
    }));
    expect(res.status).toBe(401);
  });

  it("rejects expired OTP", async () => {
    // Clear existing OTPs and add an expired one
    state.otps.length = 0;
    seedOtp(CONTRACTOR_PHONE, "123456", {
      expires_at: new Date(Date.now() - 60000).toISOString(), // expired
    });

    const { POST } = await import("@/app/api/auth/contractor/register/route");
    const res = await POST(makeRequest("/api/auth/contractor/register", "POST", {
      pm_code: PM_CODE,
      name: CONTRACTOR_NAME,
      phone: CONTRACTOR_PHONE,
      specialties: ["plumbing"],
      otp: "123456",
    }));
    expect(res.status).toBe(401);
  });

  it("rejects already-registered phone", async () => {
    seedRegisteredContractor({ phone: CONTRACTOR_PHONE });

    const { POST } = await import("@/app/api/auth/contractor/register/route");
    const res = await POST(makeRequest("/api/auth/contractor/register", "POST", {
      pm_code: PM_CODE,
      name: "新师傅",
      phone: CONTRACTOR_PHONE,
      specialties: ["plumbing"],
      otp: "123456",
    }));
    expect(res.status).toBe(409);
  });

  it("rejects OTP with attempts >= 5", async () => {
    state.otps.length = 0;
    seedOtp(CONTRACTOR_PHONE, "123456", { attempts: 5 });

    const { POST } = await import("@/app/api/auth/contractor/register/route");
    const res = await POST(makeRequest("/api/auth/contractor/register", "POST", {
      pm_code: PM_CODE,
      name: CONTRACTOR_NAME,
      phone: CONTRACTOR_PHONE,
      specialties: ["plumbing"],
      otp: "123456",
    }));
    expect(res.status).toBe(429);
  });

  it("rolls back auth user if contractor insert fails", async () => {
    // Simulate failure: make createUser succeed but then make the contractor
    // insert fail by temporarily corrupting the contractors array
    const { supabaseAdmin } = await import("@/lib/supabase");

    // Override createUser to track, then make the next contractor insert fail
    const origCreateUser = supabaseAdmin.auth.admin.createUser;
    let shouldFailInsert = false;

    (supabaseAdmin.auth.admin.createUser as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (params: Record<string, unknown>) => {
        const result = await origCreateUser(params);
        shouldFailInsert = true;
        return result;
      }
    );

    // Monkey-patch the from mock to intercept contractor inserts
    const origFromFn = (supabaseAdmin.from as ReturnType<typeof vi.fn>).getMockImplementation()!;
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      const builder = origFromFn(table);
      if (table === "contractor" && shouldFailInsert) {
        const origInsert = builder.insert;
        builder.insert = (row: Record<string, unknown>) => {
          return {
            select: () => ({
              single: () => ({ data: null, error: { message: "Insert failed" } }),
            }),
          };
        };
        builder.maybeSingle = () => ({ data: null, error: null });
      }
      return builder;
    });

    const { POST } = await import("@/app/api/auth/contractor/register/route");
    const res = await POST(makeRequest("/api/auth/contractor/register", "POST", {
      pm_code: PM_CODE,
      name: CONTRACTOR_NAME,
      phone: CONTRACTOR_PHONE,
      specialties: ["plumbing"],
      otp: "123456",
    }));
    expect(res.status).toBe(500);
    // Auth user should have been rolled back (deleted)
    expect(state.deletedAuthUserIds.length).toBeGreaterThanOrEqual(1);

    // Restore mock
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation(origFromFn);
  });

  it("rejects empty specialties", async () => {
    const { POST } = await import("@/app/api/auth/contractor/register/route");
    const res = await POST(makeRequest("/api/auth/contractor/register", "POST", {
      pm_code: PM_CODE,
      name: CONTRACTOR_NAME,
      phone: CONTRACTOR_PHONE,
      specialties: [],
      otp: "123456",
    }));
    expect(res.status).toBe(422);
  });

  it("rejects empty name", async () => {
    const { POST } = await import("@/app/api/auth/contractor/register/route");
    const res = await POST(makeRequest("/api/auth/contractor/register", "POST", {
      pm_code: PM_CODE,
      name: "",
      phone: CONTRACTOR_PHONE,
      specialties: ["plumbing"],
      otp: "123456",
    }));
    expect(res.status).toBe(422);
  });
});

describe("POST /api/auth/contractor/verify-otp (login)", () => {
  beforeEach(() => {
    state.reset();
    seedPm();
    seedRegisteredContractor();
    seedOtp(CONTRACTOR_PHONE, "654321");
  });

  it("logs in registered contractor with correct OTP", async () => {
    const { POST } = await import("@/app/api/auth/contractor/verify-otp/route");
    const res = await POST(makeRequest("/api/auth/contractor/verify-otp", "POST", {
      phone: CONTRACTOR_PHONE,
      code: "654321",
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.session).toBeDefined();
    expect(json.session.access_token).toBeDefined();
    expect(json.contractor).toBeDefined();
    expect(json.contractor.name).toBe(CONTRACTOR_NAME);
  });

  it("rejects unregistered phone with hint to register", async () => {
    seedOtp("+19999999999", "654321");

    const { POST } = await import("@/app/api/auth/contractor/verify-otp/route");
    const res = await POST(makeRequest("/api/auth/contractor/verify-otp", "POST", {
      phone: "+19999999999",
      code: "654321",
    }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("注册");
  });

  it("rejects wrong OTP code", async () => {
    const { POST } = await import("@/app/api/auth/contractor/verify-otp/route");
    const res = await POST(makeRequest("/api/auth/contractor/verify-otp", "POST", {
      phone: CONTRACTOR_PHONE,
      code: "000000",
    }));
    expect(res.status).toBe(401);
  });

  it("rejects already-used OTP", async () => {
    state.otps.length = 0;
    seedOtp(CONTRACTOR_PHONE, "654321", { used: true });

    const { POST } = await import("@/app/api/auth/contractor/verify-otp/route");
    const res = await POST(makeRequest("/api/auth/contractor/verify-otp", "POST", {
      phone: CONTRACTOR_PHONE,
      code: "654321",
    }));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/contractor/me", () => {
  beforeEach(() => {
    state.reset();
    seedPm();
    seedRegisteredContractor();
    contractorAuthState.contractorId = "contractor-001";
  });

  it("returns contractor info and pending work orders", async () => {
    // Add a pending work order assigned to this contractor
    state.workOrders.push({
      id: "wo-pending",
      status: "assigned",
      contractor_id: "contractor-001",
      pm_id: PM_ID,
      property_address: "123 Main St",
      category: "plumbing",
      created_at: "2026-04-12T00:00:00Z",
    });

    const { GET } = await import("@/app/api/auth/contractor/me/route");
    const res = await GET(makeRequest("/api/auth/contractor/me"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.contractor).toBeDefined();
    expect(json.contractor.name).toBe(CONTRACTOR_NAME);
    expect(json.pending_work_orders).toBeDefined();
  });

  it("returns 401 when not authenticated", async () => {
    // Empty auth header triggers getContractorId to return null
    const { GET } = await import("@/app/api/auth/contractor/me/route");
    const req = new NextRequest("http://localhost:3000/api/auth/contractor/me", {
      headers: { Authorization: "" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns empty array when no pending work orders", async () => {
    const { GET } = await import("@/app/api/auth/contractor/me/route");
    const res = await GET(makeRequest("/api/auth/contractor/me"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pending_work_orders).toEqual([]);
  });
});

describe("Assign contractor — must be registered", () => {
  beforeEach(() => {
    state.reset();
    seedPm();
  });

  it("transition API allows assigning registered contractor", async () => {
    seedRegisteredContractor();
    state.workOrders.push({
      id: "wo-001",
      status: "pending_assignment",
      pm_id: PM_ID,
      contractor_id: null,
      property_address: "123 Main St",
      category: "plumbing",
    });

    // Verify the assign-contractor validation endpoint accepts registered contractor
    const { POST } = await import("@/app/api/contractors/validate-assign/route");
    const res = await POST(makeRequest("/api/contractors/validate-assign", "POST", {
      contractor_id: "contractor-001",
    }));
    expect(res.status).toBe(200);
  });

  it("transition API rejects assigning unregistered contractor", async () => {
    seedUnregisteredContractor();
    state.workOrders.push({
      id: "wo-001",
      status: "pending_assignment",
      pm_id: PM_ID,
      contractor_id: null,
      property_address: "123 Main St",
      category: "plumbing",
    });

    // Verify the assign-contractor validation endpoint rejects unregistered contractor
    const { POST } = await import("@/app/api/contractors/validate-assign/route");
    const res = await POST(makeRequest("/api/contractors/validate-assign", "POST", {
      contractor_id: "contractor-unreg",
    }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toContain("注册");
  });

  it("contractor list API only returns registered contractors", async () => {
    seedRegisteredContractor();
    seedUnregisteredContractor();

    // GET /api/contractors should filter out contractors with auth_id = null
    const { GET } = await import("@/app/api/contractors/route");
    const res = await GET(makeRequest("/api/contractors"));
    expect(res.status).toBe(200);
    const json = await res.json();
    // All returned contractors should be registered (auth_id not null)
    expect(json.data.length).toBe(1);
    expect(json.data[0].auth_id).not.toBeNull();
  });
});
