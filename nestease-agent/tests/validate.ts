/**
 * Phase 0 Validation: Claude Managed Agents API
 *
 * Tests:
 * 1. Create Agent with custom tools (no built-in tools)
 * 2. Create Session (no environment needed for custom-tools-only)
 * 3. Send user message, stream SSE events
 * 4. Handle custom tool_use → return tool_result → agent resumes
 * 5. Mixed mode: text → tool → text in single turn
 * 6. Cleanup: archive agent + delete session
 */

import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

// Simulated tool handlers
function handleTool(name: string, input: Record<string, unknown>): string {
  console.log(`\n  [Tool Call] ${name}(${JSON.stringify(input)})`);

  switch (name) {
    case "get_work_order":
      return JSON.stringify({
        id: input.work_order_id,
        address: "5380 Lanoville Rd, Unit 1208",
        description: "厨房水龙头漏水，需要更换",
        status: "pending_quote",
        contractor_name: "王师傅",
        pm_name: "Jacky",
      });

    case "submit_quote":
      return JSON.stringify({
        success: true,
        quote_id: "qt-test-001",
        amount: input.amount,
        message: "报价已提交",
      });

    case "notify_pm":
      return JSON.stringify({
        success: true,
        message: `已通知PM: ${input.reason}`,
      });

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

async function validate() {
  console.log("=== Phase 0: Managed Agents API Validation ===\n");

  // Step 1: Create Agent
  console.log("[1] Creating Agent with custom tools...");
  const agent = await client.beta.agents.create({
    name: "龙虾-phase0-test",
    model: "claude-sonnet-4-6",
    system: `你是"龙虾"，栖安物管平台的 AI 助手。你通过短信代替物业经理（PM）与维修师傅（Contractor）沟通。

你为以下 PM 工作：
- PM 名字：Jacky
- 公司：测试公司

沟通风格：中文为主，简洁直接，像一个靠谱的朋友。
一次只问一个问题。任何会写入系统的操作，必须在执行前跟师傅确认。`,
    tools: [
      {
        type: "custom" as const,
        name: "get_work_order",
        description:
          "查询工单详情。根据工单ID获取工单的完整信息，包括地址、问题描述、当前状态、分配的师傅等。在回复师傅关于工单的问题时，必须先调用此工具获取最新信息，绝对不能凭记忆回答。",
        input_schema: {
          type: "object" as const,
          properties: {
            work_order_id: {
              type: "string",
              description: "工单ID",
            },
          },
          required: ["work_order_id"],
        },
      },
      {
        type: "custom" as const,
        name: "submit_quote",
        description:
          "提交师傅的报价到系统。必须在师傅明确确认报价金额和描述后才能调用。包含报价总金额和工作描述。调用前必须已经跟师傅确认过。",
        input_schema: {
          type: "object" as const,
          properties: {
            work_order_id: { type: "string", description: "工单ID" },
            amount: { type: "number", description: "报价总金额（加元）" },
            description: { type: "string", description: "工作内容描述" },
          },
          required: ["work_order_id", "amount", "description"],
        },
      },
      {
        type: "custom" as const,
        name: "notify_pm",
        description:
          "通知PM需要介入处理。当遇到你无法处理的情况时调用，包括：安全隐患、付款纠纷、师傅投诉、价格谈判、或任何你不确定的事情。",
        input_schema: {
          type: "object" as const,
          properties: {
            work_order_id: { type: "string", description: "相关工单ID" },
            reason: { type: "string", description: "需要PM介入的原因" },
            urgency: {
              type: "string",
              enum: ["normal", "urgent"],
              description: "紧急程度",
            },
          },
          required: ["work_order_id", "reason"],
        },
      },
    ],
  });
  console.log(`  Agent created: ${agent.id} (v${agent.version})`);

  // Step 1.5: Create Environment (required for sessions)
  console.log("\n[1.5] Creating Environment...");
  const environment = await client.beta.environments.create({
    name: `lobster-phase0-${Date.now()}`,
    config: {
      type: "cloud",
      networking: { type: "unrestricted" },
    },
  });
  console.log(`  Environment created: ${environment.id}`);

  // Step 2: Create Session
  console.log("\n[2] Creating Session...");
  const session = await client.beta.sessions.create({
    agent: agent.id,
    environment_id: environment.id,
  });
  console.log(`  Session created: ${session.id} (status: ${session.status})`);

  // Step 3: Send message and stream response with tool handling
  console.log("\n[3] Sending test message: contractor asks about a work order...");

  // Track tool events for tool_result responses
  const toolEvents = new Map<string, { name: string; input: Record<string, unknown> }>();

  const userMessage = `[当前时间: 2026-04-19 16:00 PDT]\n\n师傅说：我看到有个新工单 wo-test-1234，是什么情况？`;

  // Open stream first (returns Promise<Stream>), then send event
  const stream = await client.beta.sessions.events.stream(session.id);

  // Send user message
  await client.beta.sessions.events.send(session.id, {
    events: [
      {
        type: "user.message",
        content: [{ type: "text", text: userMessage }],
      },
    ],
  });

  console.log("  Streaming events...\n");

  let turnCount = 0;
  let toolCallCount = 0;

  for await (const event of stream) {
    switch (event.type) {
      case "agent.message":
        turnCount++;
        console.log(`  [Agent Message #${turnCount}]`);
        for (const block of (event as any).content || []) {
          if (block.type === "text") {
            console.log(`    "${block.text}"`);
          }
        }
        break;

      case "agent.custom_tool_use":
        toolCallCount++;
        const toolEvent = event as any;
        console.log(`\n  [Custom Tool Use #${toolCallCount}] ${toolEvent.name}`);
        toolEvents.set(event.id, {
          name: toolEvent.name,
          input: toolEvent.input,
        });
        break;

      case "session.status_idle": {
        const idleEvent = event as any;
        const stopReason = idleEvent.stop_reason;
        if (stopReason?.type === "requires_action") {
          console.log(`\n  [Session Idle - requires_action] Processing ${stopReason.event_ids.length} tool(s)...`);
          const toolResults: any[] = [];
          for (const eventId of stopReason.event_ids) {
            const tool = toolEvents.get(eventId);
            if (tool) {
              const result = handleTool(tool.name, tool.input);
              toolResults.push({
                type: "user.custom_tool_result",
                custom_tool_use_id: eventId,
                content: [{ type: "text", text: result }],
              });
            }
          }
          // Send all tool results
          await client.beta.sessions.events.send(session.id, {
            events: toolResults,
          });
          console.log(`  Sent ${toolResults.length} tool result(s), agent resuming...\n`);
        } else if (stopReason?.type === "end_turn") {
          console.log("\n  [Session Idle - end_turn] Agent finished.");
          // Close the stream iterator
          break;
        }
        break;
      }

      case "session.error":
        console.error("  [Session Error]", (event as any).error);
        break;

      case "session.status_running":
        // Agent is processing, no action needed
        break;

      default:
        // Log other events briefly
        if (!event.type.startsWith("span.")) {
          console.log(`  [${event.type}]`);
        }
    }

    // Exit after end_turn
    if ((event as any).stop_reason?.type === "end_turn") {
      break;
    }
  }

  // Step 4: Report
  console.log("\n=== Validation Results ===");
  console.log(`  Agent ID: ${agent.id}`);
  console.log(`  Session ID: ${session.id}`);
  console.log(`  Agent messages: ${turnCount}`);
  console.log(`  Tool calls: ${toolCallCount}`);
  console.log(`  Mixed mode (text→tool→text): ${turnCount > 1 ? "YES ✓" : "needs more testing"}`);

  // Step 5: Check session usage
  const finalSession = await client.beta.sessions.retrieve(session.id);
  console.log(`  Token usage: ${JSON.stringify((finalSession as any).usage)}`);

  // Step 6: Cleanup
  console.log("\n[Cleanup] Archiving agent and deleting session...");
  try {
    await client.beta.sessions.delete(session.id);
    console.log("  Session deleted.");
  } catch (err) {
    console.log("  Session delete failed (may still be running), archiving instead...");
    await client.beta.sessions.archive(session.id);
  }
  await client.beta.agents.archive(agent.id);
  console.log("  Agent archived.");
  try {
    await client.beta.environments.delete(environment.id);
    console.log("  Environment deleted.");
  } catch {
    console.log("  Environment cleanup skipped.");
  }

  console.log("\n=== Phase 0 Validation Complete ===");
}

validate().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
