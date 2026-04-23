/**
 * Phase 0 Extended Validation:
 * 1. Multi-tool calling in one turn (Agent calls tool A then tool B)
 * 2. Per-session prompt override (can we override system prompt per session?)
 */

import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

function handleTool(name: string, input: Record<string, unknown>): string {
  console.log(`    [Tool] ${name}(${JSON.stringify(input)})`);
  switch (name) {
    case "list_work_orders":
      return JSON.stringify([
        { id: "wo-001", address: "5380 Unit 1208", description: "水龙头漏水", status: "pending_quote" },
        { id: "wo-002", address: "2100 Main St", description: "马桶堵塞", status: "assigned" },
      ]);
    case "get_work_order":
      return JSON.stringify({
        id: input.work_order_id,
        address: input.work_order_id === "wo-001" ? "5380 Unit 1208" : "2100 Main St",
        description: input.work_order_id === "wo-001" ? "水龙头漏水" : "马桶堵塞",
        status: "pending_quote",
        contractor_name: "王师傅",
      });
    case "submit_quote":
      return JSON.stringify({ success: true, quote_id: "qt-001", amount: input.amount });
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

async function runSession(
  agentId: string,
  envId: string,
  message: string,
  label: string,
  sessionOverrides?: Record<string, unknown>,
): Promise<{ messages: number; tools: number; texts: string[] }> {
  console.log(`\n--- ${label} ---`);

  const sessionParams: Record<string, unknown> = {
    agent: agentId,
    environment_id: envId,
    ...sessionOverrides,
  };
  const session = await client.beta.sessions.create(sessionParams as any);
  console.log(`  Session: ${session.id}`);

  const toolEvents = new Map<string, { name: string; input: Record<string, unknown> }>();
  const stream = await client.beta.sessions.events.stream(session.id);

  await client.beta.sessions.events.send(session.id, {
    events: [{ type: "user.message", content: [{ type: "text", text: message }] }],
  });

  let messages = 0;
  let tools = 0;
  const texts: string[] = [];

  for await (const event of stream) {
    switch (event.type) {
      case "agent.message":
        messages++;
        for (const block of (event as any).content || []) {
          if (block.type === "text") {
            texts.push(block.text);
            console.log(`  [Text] "${block.text.slice(0, 120)}${block.text.length > 120 ? "..." : ""}"`);
          }
        }
        break;
      case "agent.custom_tool_use":
        tools++;
        const te = event as any;
        toolEvents.set(event.id, { name: te.name, input: te.input });
        break;
      case "session.status_idle": {
        const ie = event as any;
        const sr = ie.stop_reason;
        if (sr?.type === "requires_action") {
          const results: any[] = [];
          for (const eid of sr.event_ids) {
            const t = toolEvents.get(eid);
            if (t) {
              const r = handleTool(t.name, t.input);
              results.push({ type: "user.custom_tool_result", custom_tool_use_id: eid, content: [{ type: "text", text: r }] });
            }
          }
          await client.beta.sessions.events.send(session.id, { events: results });
        } else if (sr?.type === "end_turn") {
          break;
        }
        break;
      }
      case "session.error":
        console.error("  [Error]", (event as any).error);
        break;
    }
    if ((event as any).stop_reason?.type === "end_turn") break;
  }

  // Cleanup
  try { await client.beta.sessions.delete(session.id); } catch { /* ok */ }

  console.log(`  Result: ${messages} messages, ${tools} tool calls`);
  return { messages, tools, texts };
}

async function main() {
  console.log("=== Extended Validation ===\n");

  // Create agent with multiple tools
  const agent = await client.beta.agents.create({
    name: `extended-test-${Date.now()}`,
    model: "claude-sonnet-4-6",
    system: "你是龙虾，栖安物管平台的工单助手。你为PM Jacky工作。用中文回复，简洁直接。",
    tools: [
      {
        type: "custom" as const,
        name: "list_work_orders",
        description: "列出某个师傅当前所有活跃工单。返回工单列表，包括ID、地址、描述、状态。",
        input_schema: { type: "object" as const, properties: { contractor_id: { type: "string" } }, required: ["contractor_id"] },
      },
      {
        type: "custom" as const,
        name: "get_work_order",
        description: "查询单个工单的详细信息。",
        input_schema: { type: "object" as const, properties: { work_order_id: { type: "string" } }, required: ["work_order_id"] },
      },
      {
        type: "custom" as const,
        name: "submit_quote",
        description: "提交师傅的报价。必须师傅确认后才能调用。",
        input_schema: {
          type: "object" as const,
          properties: {
            work_order_id: { type: "string" },
            amount: { type: "number" },
            description: { type: "string" },
          },
          required: ["work_order_id", "amount", "description"],
        },
      },
    ],
  });
  console.log(`Agent: ${agent.id}`);

  const env = await client.beta.environments.create({
    name: `extended-env-${Date.now()}`,
    config: { type: "cloud", networking: { type: "unrestricted" } },
  });
  console.log(`Environment: ${env.id}`);

  // Test 1: Multi-tool calling
  const test1 = await runSession(
    agent.id,
    env.id,
    "[当前时间: 2026-04-19 16:00 PDT]\n\n师傅说：我现在手上有什么活？5380那个具体是什么情况？",
    "Test 1: Multi-tool calling (list_work_orders + get_work_order)",
  );
  const multiToolPass = test1.tools >= 2;
  console.log(`  ✓ Multi-tool: ${multiToolPass ? "PASS" : "FAIL"} (${test1.tools} tools called)\n`);

  // Test 2: Per-session prompt override
  // Try overriding system prompt at session level
  let overridePass = false;
  let overrideMethod = "none";

  // Method 1: Try session-level system override
  try {
    const test2 = await runSession(
      agent.id,
      env.id,
      "你叫什么名字？你为谁工作？",
      "Test 2a: Per-session override via session.system",
      { system: "你是小龙，栖安物管平台的工单助手。你为PM Alice工作。用中文回复。" } as any,
    );
    const hasAlice = test2.texts.some((t) => t.includes("Alice") || t.includes("小龙"));
    if (hasAlice) {
      overridePass = true;
      overrideMethod = "session.system";
      console.log(`  ✓ Per-session override via session.system: PASS\n`);
    } else {
      console.log(`  ✗ Per-session override via session.system: texts don't contain override content\n`);
    }
  } catch (err: any) {
    console.log(`  ✗ session.system not supported: ${err.message?.slice(0, 100)}\n`);
  }

  // Method 2: Try agent version override at session level
  if (!overridePass) {
    try {
      // Create a second agent with different prompt
      const agent2 = await client.beta.agents.create({
        name: `override-test-${Date.now()}`,
        model: "claude-sonnet-4-6",
        system: "你是小龙，栖安物管平台的工单助手。你为PM Alice工作。用中文回复。",
        tools: agent.tools,
      });
      const test2b = await runSession(
        agent2.id,
        env.id,
        "你叫什么名字？你为谁工作？",
        "Test 2b: Separate agent per PM",
      );
      const hasAlice = test2b.texts.some((t) => t.includes("Alice") || t.includes("小龙"));
      overridePass = hasAlice;
      overrideMethod = "separate_agent_per_pm";
      console.log(`  ${hasAlice ? "✓" : "✗"} Separate agent per PM: ${hasAlice ? "PASS" : "FAIL"}\n`);
      await client.beta.agents.archive(agent2.id);
    } catch (err: any) {
      console.log(`  ✗ Separate agent test failed: ${err.message?.slice(0, 100)}\n`);
    }
  }

  // Summary
  console.log("\n=== Extended Validation Results ===");
  console.log(`  Multi-tool calling: ${multiToolPass ? "PASS ✓" : "FAIL ✗"} (${test1.tools} tools in one turn)`);
  console.log(`  Per-session override: ${overridePass ? "PASS ✓" : "FAIL ✗"} (method: ${overrideMethod})`);

  // Cleanup
  await client.beta.agents.archive(agent.id);
  try { await client.beta.environments.delete(env.id); } catch { /* ok */ }

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
