/**
 * Agent Scenario Runner: end-to-end behavioral tests for the 龙虾 AI Agent.
 *
 * Runs real conversations through processMessage() / sendSystemMessage()
 * against real Anthropic API + Supabase, then collects tool calls + DB state
 * for human analysis.
 *
 * Usage:
 *   npx tsx tests/scenario-runner.ts              # run all scenarios
 *   npx tsx tests/scenario-runner.ts onboarding   # run specific scenario
 */

import { supabase } from "../src/lib/supabase.js";
import { processMessage, sendSystemMessage } from "../src/agent/session-manager.js";
import { writeFileSync } from "fs";
import { resolve } from "path";

// ── Types ──────────────────────────────────────────────────────────────────

interface TurnResult {
  send: string;
  sendType: "sms" | "system";
  reply: string;
  toolCalls: { name: string; input: Record<string, unknown> }[];
  checks: { label: string; pass: boolean }[];
  durationMs: number;
}

interface ScenarioResult {
  name: string;
  turns: TurnResult[];
  dbState: Record<string, unknown>;
  passed: number;
  failed: number;
  totalChecks: number;
  durationMs: number;
}

interface TestContext {
  pmId: string;
  contractorId: string;
  contractorName: string;
  phone: string;
  workOrderIds: string[];
  sessionId?: string;
}

// ── Test Data Helpers ──────────────────────────────────────────────────────

const TEST_PHONE_PREFIX = "+1555"; // test-only phone prefix

function testPhone(suffix: number): string {
  // Use timestamp + suffix for uniqueness to avoid collisions with stale data
  const ts = Date.now().toString().slice(-6);
  return `${TEST_PHONE_PREFIX}${ts}${suffix}`;
}

/**
 * Find the first PM in the system (we reuse existing PM to avoid creating
 * agents with incomplete config).
 */
async function findPm(): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from("pm")
    .select("id, name")
    .limit(1)
    .single();

  if (error || !data) throw new Error("No PM found in database. Cannot run tests.");
  return data;
}

async function createTestContractor(
  pmId: string,
  name: string,
  phone: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("contractor")
    .insert({ name, phone, pm_id: pmId })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create contractor: ${error.message}`);
  return data!.id;
}

/**
 * Cached reference IDs for foreign key constraints.
 * Uses existing records to avoid creating unnecessary test data.
 */
let cachedRefs: { propertyId: string; tenantId: string; ownerId: string } | null = null;
async function findReferenceIds(): Promise<{ propertyId: string; tenantId: string; ownerId: string }> {
  if (cachedRefs) return cachedRefs;

  const [propRes, tenantRes, ownerRes] = await Promise.all([
    supabase.from("property").select("id").limit(1).single(),
    supabase.from("tenant").select("id").limit(1).single(),
    supabase.from("owner").select("id").limit(1).single(),
  ]);

  if (!propRes.data) throw new Error("No property found in database.");
  if (!tenantRes.data) throw new Error("No tenant found in database.");
  if (!ownerRes.data) throw new Error("No owner found in database.");

  cachedRefs = {
    propertyId: propRes.data.id,
    tenantId: tenantRes.data.id,
    ownerId: ownerRes.data.id,
  };
  return cachedRefs;
}

async function createTestWorkOrder(
  contractorId: string,
  pmId: string,
  opts: {
    status?: string;
    address?: string;
    unit?: string;
    description?: string;
    category?: string;
    urgency?: string;
  } = {},
): Promise<string> {
  const refs = await findReferenceIds();
  const { data, error } = await supabase
    .from("work_order")
    .insert({
      contractor_id: contractorId,
      pm_id: pmId,
      property_id: refs.propertyId,
      tenant_id: refs.tenantId,
      owner_id: refs.ownerId,
      tenant_name: "测试租户",
      tenant_phone: "5551234567",
      status: opts.status || "assigned",
      property_address: opts.address || "5380 Lanoville Rd",
      unit: opts.unit || "1208",
      description: opts.description || "厨房水龙头漏水，需要更换",
      category: opts.category || "plumbing",
      urgency: opts.urgency || "normal",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create work order: ${error.message}`);
  return data!.id;
}

async function cleanup(ctx: TestContext): Promise<void> {
  // Delete in reverse dependency order
  // Conversation logs
  if (ctx.contractorId) {
    await supabase
      .from("agent_conversation_log")
      .delete()
      .eq("contractor_id", ctx.contractorId);
  }

  // Agent memories
  if (ctx.contractorId) {
    await supabase
      .from("agent_memories")
      .delete()
      .eq("contractor_id", ctx.contractorId);
  }

  // Agent sessions
  if (ctx.contractorId) {
    await supabase
      .from("agent_sessions")
      .delete()
      .eq("contractor_id", ctx.contractorId);
  }

  // Status history for work orders
  for (const woId of ctx.workOrderIds) {
    await supabase
      .from("work_order_status_history")
      .delete()
      .eq("work_order_id", woId);
  }

  // Quotes for work orders
  for (const woId of ctx.workOrderIds) {
    await supabase
      .from("quote")
      .delete()
      .eq("work_order_id", woId);
  }

  // Work orders
  for (const woId of ctx.workOrderIds) {
    await supabase.from("work_order").delete().eq("id", woId);
  }

  // Contractor
  if (ctx.contractorId) {
    await supabase.from("contractor").delete().eq("id", ctx.contractorId);
  }

  console.log(`  [Cleanup] Done for contractor ${ctx.contractorId}`);
}

// ── Result Collection ──────────────────────────────────────────────────────

/**
 * Get tool calls from the most recent outbound conversation log entries
 * that were created after `afterTime`.
 */
async function getToolCallsSince(
  contractorId: string,
  afterTime: string,
): Promise<{ name: string; input: Record<string, unknown> }[]> {
  const { data } = await supabase
    .from("agent_conversation_log")
    .select("tool_calls")
    .eq("contractor_id", contractorId)
    .eq("direction", "outbound")
    .gt("created_at", afterTime)
    .order("created_at", { ascending: true });

  const allCalls: { name: string; input: Record<string, unknown> }[] = [];
  for (const row of data || []) {
    if (row.tool_calls && Array.isArray(row.tool_calls)) {
      allCalls.push(...(row.tool_calls as { name: string; input: Record<string, unknown> }[]));
    }
  }
  return allCalls;
}

async function getWorkOrderState(woId: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("work_order")
    .select("id, status, approval_status, quote_id, completed_at")
    .eq("id", woId)
    .single();
  return data;
}

async function getSessionState(contractorId: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("agent_sessions")
    .select("session_id, confirmed, status")
    .eq("contractor_id", contractorId)
    .eq("status", "active")
    .single();
  return data;
}

async function getLatestQuote(woId: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("quote")
    .select("total, labor_hours, labor_rate, labor_cost, materials_cost, other_cost")
    .eq("work_order_id", woId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .single();
  return data;
}

// ── Check Helpers ──────────────────────────────────────────────────────────

function checkToolCalled(
  toolCalls: { name: string }[],
  toolName: string,
): { label: string; pass: boolean } {
  const pass = toolCalls.some((tc) => tc.name === toolName);
  return { label: `tool_called:${toolName}`, pass };
}

function checkToolNotCalled(
  toolCalls: { name: string }[],
  toolName: string,
): { label: string; pass: boolean } {
  const pass = !toolCalls.some((tc) => tc.name === toolName);
  return { label: `tool_not_called:${toolName}`, pass };
}

function checkReplyContains(
  reply: string,
  keywords: string[],
): { label: string; pass: boolean } {
  const pass = keywords.some((kw) => reply.includes(kw));
  return {
    label: `reply_contains:[${keywords.join("|")}]`,
    pass,
  };
}

function checkReplyExcludes(
  reply: string,
  keywords: string[],
): { label: string; pass: boolean } {
  const pass = !keywords.some((kw) => reply.includes(kw));
  return {
    label: `reply_excludes:[${keywords.join("|")}]`,
    pass,
  };
}

/**
 * Check that a tool was called with input values satisfying a predicate.
 * Useful for validating data completeness of submitted tool calls.
 */
function checkToolInput(
  toolCalls: { name: string; input: Record<string, unknown> }[],
  toolName: string,
  label: string,
  predicate: (input: Record<string, unknown>) => boolean,
): { label: string; pass: boolean } {
  const call = toolCalls.find((tc) => tc.name === toolName);
  if (!call) return { label: `tool_input:${toolName}:${label}`, pass: false };
  return { label: `tool_input:${toolName}:${label}`, pass: predicate(call.input) };
}

// ── Turn Execution ─────────────────────────────────────────────────────────

async function executeTurn(
  ctx: TestContext,
  message: string,
  type: "sms" | "system",
  checks: (toolCalls: { name: string; input: Record<string, unknown> }[], reply: string) => { label: string; pass: boolean }[],
  systemOpts?: { workOrderId?: string },
): Promise<TurnResult> {
  const beforeTime = new Date().toISOString();
  const start = Date.now();

  let reply: string;
  if (type === "sms") {
    reply = await processMessage(ctx.phone, message);
  } else {
    reply = await sendSystemMessage(
      ctx.contractorId,
      ctx.pmId,
      ctx.phone,
      message,
      systemOpts?.workOrderId,
    );
  }

  const durationMs = Date.now() - start;

  // Small delay to ensure logs are written
  await new Promise((r) => setTimeout(r, 500));

  const toolCalls = await getToolCallsSince(ctx.contractorId, beforeTime);
  const checkResults = checks(toolCalls, reply);

  return {
    send: message,
    sendType: type,
    reply,
    toolCalls,
    checks: checkResults,
    durationMs,
  };
}

// ── Scenarios ──────────────────────────────────────────────────────────────

type ScenarioFn = (ctx: TestContext) => Promise<{ turns: TurnResult[]; dbState: Record<string, unknown> }>;

const scenarios: Record<string, { name: string; setup: (pm: { id: string; name: string }, phoneSuffix: number) => Promise<TestContext>; run: ScenarioFn }> = {

  onboarding: {
    name: "首次接触 + 身份确认",
    setup: async (pm, suffix) => {
      const phone = testPhone(suffix);
      const contractorId = await createTestContractor(pm.id, "测试张三", phone);
      const woId = await createTestWorkOrder(contractorId, pm.id);
      return { pmId: pm.id, contractorId, contractorName: "测试张三", phone, workOrderIds: [woId] };
    },
    run: async (ctx) => {
      const turns: TurnResult[] = [];

      // Turn 1: First contact
      turns.push(await executeTurn(ctx, "你好", "sms", (tools, reply) => [
        checkReplyContains(reply, ["龙虾", "你好", "请问"]),
        checkReplyContains(reply, ["张三", "师傅"]),
      ]));

      // Turn 2: Confirm identity
      turns.push(await executeTurn(ctx, "是的", "sms", (tools, reply) => [
        checkToolCalled(tools, "confirm_identity"),
      ]));

      // DB checks
      const session = await getSessionState(ctx.contractorId);
      const dbState = { session };

      return { turns, dbState };
    },
  },

  dispatch: {
    name: "派单通知 (sendSystemMessage)",
    setup: async (pm, suffix) => {
      const phone = testPhone(suffix);
      const contractorId = await createTestContractor(pm.id, "测试李四", phone);
      const woId = await createTestWorkOrder(contractorId, pm.id, {
        description: "卫生间马桶堵塞",
        address: "2100 Main St",
        unit: "305",
      });
      // Pre-confirm the session by sending an initial message first
      // (or we accept the onboarding flow happens as part of this test)
      return { pmId: pm.id, contractorId, contractorName: "测试李四", phone, workOrderIds: [woId] };
    },
    run: async (ctx) => {
      const turns: TurnResult[] = [];

      // System message: new work order dispatched
      turns.push(await executeTurn(
        ctx,
        "[系统通知] 新工单已派发给该师傅",
        "system",
        (tools, reply) => [
          checkToolCalled(tools, "get_work_order"),
          checkReplyContains(reply, ["2100", "305", "马桶", "堵塞"]),
        ],
        { workOrderId: ctx.workOrderIds[0] },
      ));

      const woState = await getWorkOrderState(ctx.workOrderIds[0]);
      return { turns, dbState: { workOrder: woState } };
    },
  },

  accept: {
    name: "接单流程",
    setup: async (pm, suffix) => {
      const phone = testPhone(suffix);
      const contractorId = await createTestContractor(pm.id, "测试王五", phone);
      const woId = await createTestWorkOrder(contractorId, pm.id);
      return { pmId: pm.id, contractorId, contractorName: "测试王五", phone, workOrderIds: [woId] };
    },
    run: async (ctx) => {
      const turns: TurnResult[] = [];

      // Turn 1: Greet (triggers onboarding)
      turns.push(await executeTurn(ctx, "你好", "sms", (tools, reply) => [
        checkReplyContains(reply, ["龙虾"]),
      ]));

      // Turn 2: Confirm identity
      turns.push(await executeTurn(ctx, "是我", "sms", (tools, reply) => [
        checkToolCalled(tools, "confirm_identity"),
      ]));

      // Turn 3: Accept the work order
      turns.push(await executeTurn(ctx, "好的我接了", "sms", (tools, reply) => [
        checkToolCalled(tools, "accept_work_order"),
        checkReplyContains(reply, ["接", "报价"]),
      ]));

      const woState = await getWorkOrderState(ctx.workOrderIds[0]);
      return {
        turns,
        dbState: {
          workOrder: woState,
          expectedStatus: "quoting",
          statusMatch: woState?.status === "quoting",
        },
      };
    },
  },

  quote: {
    name: "报价收集 + 提交",
    setup: async (pm, suffix) => {
      const phone = testPhone(suffix);
      const contractorId = await createTestContractor(pm.id, "测试赵六", phone);
      // Start in quoting state (already accepted)
      const woId = await createTestWorkOrder(contractorId, pm.id, { status: "quoting" });
      // Pre-create a confirmed session by going through onboarding
      return { pmId: pm.id, contractorId, contractorName: "测试赵六", phone, workOrderIds: [woId] };
    },
    run: async (ctx) => {
      const turns: TurnResult[] = [];

      // Turn 1: First contact + onboarding
      turns.push(await executeTurn(ctx, "你好", "sms", (_tools, reply) => [
        checkReplyContains(reply, ["龙虾"]),
      ]));

      // Turn 2: Confirm identity
      turns.push(await executeTurn(ctx, "是", "sms", (tools, _reply) => [
        checkToolCalled(tools, "confirm_identity"),
      ]));

      // Turn 3: Provide quote
      turns.push(await executeTurn(
        ctx,
        "报价1000块，人工8小时125一小时，没有材料费，大概三天能搞完",
        "sms",
        (_tools, reply) => [
          // Agent should summarize and ask for confirmation, NOT submit yet
          checkReplyContains(reply, ["1000", "确认", "确", "提交", "对"]),
          checkToolNotCalled(_tools, "submit_quote"),
        ],
      ));

      // Turn 4: Confirm quote submission
      turns.push(await executeTurn(ctx, "对，提交吧", "sms", (tools, reply) => [
        checkToolCalled(tools, "submit_quote"),
      ]));

      const woState = await getWorkOrderState(ctx.workOrderIds[0]);
      const quote = await getLatestQuote(ctx.workOrderIds[0]);
      return {
        turns,
        dbState: {
          workOrder: woState,
          quote,
        },
      };
    },
  },

  completion: {
    name: "完工报告提交",
    setup: async (pm, suffix) => {
      const phone = testPhone(suffix);
      const contractorId = await createTestContractor(pm.id, "测试孙七", phone);
      const woId = await createTestWorkOrder(contractorId, pm.id, { status: "in_progress" });
      return { pmId: pm.id, contractorId, contractorName: "测试孙七", phone, workOrderIds: [woId] };
    },
    run: async (ctx) => {
      const turns: TurnResult[] = [];

      // Turn 1: Onboarding
      turns.push(await executeTurn(ctx, "你好", "sms", (_tools, reply) => [
        checkReplyContains(reply, ["龙虾"]),
      ]));

      // Turn 2: Confirm
      turns.push(await executeTurn(ctx, "是", "sms", (tools) => [
        checkToolCalled(tools, "confirm_identity"),
      ]));

      // Turn 3: Report completion
      turns.push(await executeTurn(
        ctx,
        "搞好了，换了新水龙头，测试过不漏水了",
        "sms",
        (_tools, reply) => [
          // Agent should confirm before submitting
          checkReplyContains(reply, ["确认", "照片", "完工", "提交"]),
        ],
      ));

      // Turn 4: No photos, confirm submission
      turns.push(await executeTurn(ctx, "没拍照，直接提交吧", "sms", (tools, reply) => [
        checkToolCalled(tools, "submit_completion"),
      ]));

      const woState = await getWorkOrderState(ctx.workOrderIds[0]);
      return {
        turns,
        dbState: {
          workOrder: woState,
          expectedStatus: "pending_verification",
          statusMatch: woState?.status === "pending_verification",
        },
      };
    },
  },

  quote_validation: {
    name: "报价数据完整性校验",
    setup: async (pm, suffix) => {
      const phone = testPhone(suffix);
      const contractorId = await createTestContractor(pm.id, "测试钱九", phone);
      const woId = await createTestWorkOrder(contractorId, pm.id, { status: "quoting" });
      return { pmId: pm.id, contractorId, contractorName: "测试钱九", phone, workOrderIds: [woId] };
    },
    run: async (ctx) => {
      const turns: TurnResult[] = [];

      // Turn 1: Onboarding
      turns.push(await executeTurn(ctx, "你好", "sms", (_tools, reply) => [
        checkReplyContains(reply, ["龙虾"]),
      ]));

      // Turn 2: Confirm identity
      turns.push(await executeTurn(ctx, "是", "sms", (tools) => [
        checkToolCalled(tools, "confirm_identity"),
      ]));

      // Turn 3: Give only total price, no breakdown
      // Agent should ask for breakdown, or if it tries to submit, server rejects
      turns.push(await executeTurn(
        ctx,
        "报价1000刀",
        "sms",
        (tools, reply) => [
          // Agent should NOT successfully submit with incomplete data
          // Either it asks for more info, or server-side validation rejects it
          checkReplyContains(reply, ["工时", "小时", "时薪", "多少", "breakdown", "拆", "人工"]),
        ],
      ));

      // Turn 4: Provide full breakdown
      turns.push(await executeTurn(
        ctx,
        "人工8小时125一小时，没有材料，三天后搞完",
        "sms",
        (_tools, reply) => [
          // Agent may ask about other costs (following 5-step flow) or summarize
          checkReplyContains(reply, ["其他", "费用", "出行", "1000", "确认"]),
        ],
      ));

      // Turn 5: No other costs
      turns.push(await executeTurn(ctx, "没有其他费用", "sms", (_tools, reply) => [
        // Agent should now summarize the full quote for confirmation
        checkReplyContains(reply, ["1000", "8", "125", "确", "提交"]),
      ]));

      // Turn 6: Confirm and submit
      turns.push(await executeTurn(ctx, "对，提交吧", "sms", (tools, reply) => [
        checkToolCalled(tools, "submit_quote"),
        // Verify the submitted data has proper breakdown
        checkToolInput(tools, "submit_quote", "labor_hours>0", (input) => (input.labor_hours as number) > 0),
        checkToolInput(tools, "submit_quote", "labor_rate>0", (input) => (input.labor_rate as number) > 0),
        checkToolInput(tools, "submit_quote", "has_estimated_completion", (input) => !!input.estimated_completion),
      ]));

      const woState = await getWorkOrderState(ctx.workOrderIds[0]);
      const quote = await getLatestQuote(ctx.workOrderIds[0]);
      return {
        turns,
        dbState: {
          workOrder: woState,
          quote,
          quoteHasBreakdown: quote && (quote.labor_hours as number) > 0 && (quote.labor_rate as number) > 0,
        },
      };
    },
  },

  completion_validation: {
    name: "完工数据完整性校验",
    setup: async (pm, suffix) => {
      const phone = testPhone(suffix);
      const contractorId = await createTestContractor(pm.id, "测试吴十", phone);
      const woId = await createTestWorkOrder(contractorId, pm.id, {
        status: "in_progress",
        description: "厨房水龙头漏水，需要更换",
      });
      return { pmId: pm.id, contractorId, contractorName: "测试吴十", phone, workOrderIds: [woId] };
    },
    run: async (ctx) => {
      const turns: TurnResult[] = [];

      // Turn 1: Onboarding
      turns.push(await executeTurn(ctx, "你好", "sms", (_tools, reply) => [
        checkReplyContains(reply, ["龙虾"]),
      ]));

      // Turn 2: Confirm identity
      turns.push(await executeTurn(ctx, "是", "sms", (tools) => [
        checkToolCalled(tools, "confirm_identity"),
      ]));

      // Turn 3: Report completion with minimal info
      // Agent should ask for more details, or server rejects if notes too short
      turns.push(await executeTurn(
        ctx,
        "搞好了",
        "sms",
        (tools, reply) => [
          // Agent should NOT submit "搞好了" as completion notes (too short, <10 chars)
          // Should ask for more details about what was done
          checkReplyContains(reply, ["做了什么", "描述", "具体", "什么工作", "维修", "详细"]),
        ],
      ));

      // Turn 4: Provide sufficient detail
      turns.push(await executeTurn(
        ctx,
        "换了新的水龙头，旧的拆掉了，测试过没有漏水",
        "sms",
        (_tools, reply) => [
          // Agent should confirm before submitting
          checkReplyContains(reply, ["确认", "提交", "完工", "照片"]),
        ],
      ));

      // Turn 5: Decline photos first time
      turns.push(await executeTurn(ctx, "不拍照了直接提交", "sms", (_tools, reply) => [
        // Agent pushes for photos a second time per prompt rules
        checkReplyContains(reply, ["照片", "拍", "记录"]),
      ]));

      // Turn 6: Decline photos again — agent summarizes completion report for confirmation
      turns.push(await executeTurn(ctx, "真不拍了，直接提交吧", "sms", (_tools, reply) => [
        checkReplyContains(reply, ["提交", "完工", "水龙头", "更换"]),
      ]));

      // Turn 7: Confirm submission
      turns.push(await executeTurn(ctx, "好，提交", "sms", (tools, reply) => [
        checkToolCalled(tools, "submit_completion"),
        // Verify completion_notes is substantial (>= 10 chars)
        checkToolInput(tools, "submit_completion", "notes>=10chars", (input) =>
          typeof input.completion_notes === "string" && input.completion_notes.length >= 10,
        ),
      ]));

      const woState = await getWorkOrderState(ctx.workOrderIds[0]);
      return {
        turns,
        dbState: {
          workOrder: woState,
          expectedStatus: "pending_verification",
          statusMatch: woState?.status === "pending_verification",
        },
      };
    },
  },

  multi_order: {
    name: "多工单消歧",
    setup: async (pm, suffix) => {
      const phone = testPhone(suffix);
      const contractorId = await createTestContractor(pm.id, "测试周八", phone);
      const woId1 = await createTestWorkOrder(contractorId, pm.id, {
        address: "5380 Lanoville Rd",
        unit: "1208",
        description: "水龙头漏水",
        status: "in_progress",
      });
      const woId2 = await createTestWorkOrder(contractorId, pm.id, {
        address: "2100 Main St",
        unit: "305",
        description: "马桶堵塞",
        status: "assigned",
      });
      return { pmId: pm.id, contractorId, contractorName: "测试周八", phone, workOrderIds: [woId1, woId2] };
    },
    run: async (ctx) => {
      const turns: TurnResult[] = [];

      // Turn 1: Onboarding
      turns.push(await executeTurn(ctx, "你好", "sms", (_tools, reply) => [
        checkReplyContains(reply, ["龙虾"]),
      ]));

      // Turn 2: Confirm
      turns.push(await executeTurn(ctx, "是", "sms", (tools) => [
        checkToolCalled(tools, "confirm_identity"),
      ]));

      // Turn 3: Ambiguous message — agent should ask which order
      turns.push(await executeTurn(ctx, "搞好了", "sms", (_tools, reply) => [
        // Agent should disambiguate since there are 2 active orders
        checkReplyContains(reply, ["哪个", "哪", "5380", "2100", "水龙头", "马桶"]),
      ]));

      return { turns, dbState: {} };
    },
  },
};

// ── Runner ─────────────────────────────────────────────────────────────────

function formatTurnResult(idx: number, turn: TurnResult): string {
  const lines: string[] = [];
  lines.push(`  [Turn ${idx + 1}] Send (${turn.sendType}): "${turn.send.slice(0, 80)}${turn.send.length > 80 ? "..." : ""}"`);
  lines.push(`  [Turn ${idx + 1}] Reply: "${turn.reply.slice(0, 120)}${turn.reply.length > 120 ? "..." : ""}"`);

  if (turn.toolCalls.length > 0) {
    const toolStr = turn.toolCalls
      .map((tc) => `${tc.name}(${JSON.stringify(tc.input).slice(0, 60)})`)
      .join(", ");
    lines.push(`  [Turn ${idx + 1}] Tools: ${toolStr}`);
  } else {
    lines.push(`  [Turn ${idx + 1}] Tools: (none)`);
  }

  for (const check of turn.checks) {
    const icon = check.pass ? "PASS" : "FAIL";
    lines.push(`  [Turn ${idx + 1}] ${icon} ${check.label}`);
  }

  lines.push(`  [Turn ${idx + 1}] Duration: ${turn.durationMs}ms`);
  return lines.join("\n");
}

async function runScenario(
  key: string,
  scenario: typeof scenarios[string],
  pm: { id: string; name: string },
  phoneSuffix: number,
): Promise<ScenarioResult> {
  console.log(`\n=== ${scenario.name} ===`);

  const start = Date.now();
  const ctx = await scenario.setup(pm, phoneSuffix);
  console.log(`  [Setup] contractor=${ctx.contractorId}, phone=${ctx.phone}, orders=${ctx.workOrderIds.join(",")}`);

  let result: { turns: TurnResult[]; dbState: Record<string, unknown> };
  try {
    result = await scenario.run(ctx);
  } catch (err: any) {
    console.error(`  [ERROR] Scenario failed: ${err.message}`);
    result = { turns: [], dbState: { error: err.message } };
  }

  // Print results
  for (let i = 0; i < result.turns.length; i++) {
    console.log(formatTurnResult(i, result.turns[i]));
  }

  // Summarize
  let passed = 0;
  let failed = 0;
  for (const turn of result.turns) {
    for (const check of turn.checks) {
      if (check.pass) passed++;
      else failed++;
    }
  }
  const totalChecks = passed + failed;
  const durationMs = Date.now() - start;

  console.log(`\n  DB State: ${JSON.stringify(result.dbState, null, 2)}`);
  console.log(`  === Result: ${passed}/${totalChecks} PASS${failed > 0 ? ` (${failed} FAIL)` : ""} — ${durationMs}ms ===`);

  // Cleanup
  try {
    await cleanup(ctx);
  } catch (err: any) {
    console.error(`  [Cleanup Error] ${err.message}`);
  }

  return {
    name: scenario.name,
    turns: result.turns,
    dbState: result.dbState,
    passed,
    failed,
    totalChecks,
    durationMs,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const scenarioFilter = args.length > 0 ? args : null;

  console.log("=== 龙虾 Agent Scenario Runner ===");
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Filter: ${scenarioFilter ? scenarioFilter.join(", ") : "all"}\n`);

  // Find PM
  const pm = await findPm();
  console.log(`Using PM: ${pm.name} (${pm.id})`);

  const results: ScenarioResult[] = [];
  let phoneSuffix = 1;

  for (const [key, scenario] of Object.entries(scenarios)) {
    if (scenarioFilter && !scenarioFilter.includes(key)) continue;

    const result = await runScenario(key, scenario, pm, phoneSuffix++);
    results.push(result);
  }

  // Summary
  console.log("\n\n=== SUMMARY ===");
  let totalPassed = 0;
  let totalFailed = 0;
  for (const r of results) {
    const icon = r.failed === 0 ? "PASS" : "FAIL";
    console.log(`  ${icon} ${r.name}: ${r.passed}/${r.totalChecks} — ${r.durationMs}ms`);
    totalPassed += r.passed;
    totalFailed += r.failed;
  }
  console.log(`\n  Total: ${totalPassed}/${totalPassed + totalFailed} checks passed`);

  // Save to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = resolve(import.meta.dirname || ".", "results", `run-${timestamp}.json`);
  writeFileSync(outPath, JSON.stringify({ timestamp: new Date().toISOString(), pm, results }, null, 2));
  console.log(`\n  Results saved to: ${outPath}`);

  // Exit with error code if any failures
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
