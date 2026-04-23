"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  message: string;
  tool_calls: Array<{ name: string; input: Record<string, unknown> }> | null;
  work_order_id: string | null;
  created_at: string;
}

interface ContractorInfo {
  name: string;
  phone: string;
}

interface Memory {
  key: string;
  content: string;
}

interface WorkOrder {
  id: string;
  status: string;
  address: string;
  description: string;
}

const TOOL_LABELS: Record<string, { label: string; color: string }> = {
  accept_work_order: { label: "接单", color: "bg-green-50 text-green-700 border-green-200" },
  submit_quote: { label: "提交报价", color: "bg-blue-50 text-blue-700 border-blue-200" },
  submit_completion: { label: "提交完工", color: "bg-blue-50 text-blue-700 border-blue-200" },
  confirm_identity: { label: "身份确认", color: "bg-green-50 text-green-700 border-green-200" },
  notify_pm: { label: "通知PM", color: "bg-orange-50 text-orange-700 border-orange-200" },
  save_memory: { label: "保存记忆", color: "bg-gray-50 text-gray-600 border-gray-200" },
  get_memories: { label: "读取记忆", color: "bg-gray-50 text-gray-600 border-gray-200" },
  get_work_order: { label: "查询工单", color: "bg-gray-50 text-gray-600 border-gray-200" },
  list_work_orders: { label: "列出工单", color: "bg-gray-50 text-gray-600 border-gray-200" },
};

/** Extract photo URLs from message text patterns like [师傅发了 N 张照片: url1, url2] or 完工照片: url1, url2 */
function extractPhotos(text: string): { cleanText: string; photoUrls: string[] } {
  const urls: string[] = [];
  let cleaned = text;

  // Match [师傅发了 N 张照片: url1, url2]
  const inboundMatch = cleaned.match(/\[师傅发了\s*\d+\s*张照片:\s*(https?:\/\/[^\]]+)\]/);
  if (inboundMatch) {
    const urlStr = inboundMatch[1];
    urls.push(...urlStr.split(/,\s*/).map(u => u.trim()).filter(u => u.startsWith("http")));
    cleaned = cleaned.replace(inboundMatch[0], "").trim();
  }

  // Match 完工照片: url1, url2
  const completionMatch = cleaned.match(/完工照片:\s*(https?:\/\/\S+(?:,\s*https?:\/\/\S+)*)/);
  if (completionMatch) {
    urls.push(...completionMatch[1].split(/,\s*/).map(u => u.trim()).filter(u => u.startsWith("http")));
    cleaned = cleaned.replace(completionMatch[0], "").trim();
  }

  return { cleanText: cleaned, photoUrls: urls };
}

function cleanMessage(msg: string, direction: string): { text: string; isSystemEvent: boolean } {
  // Check for system notification in both directions (sendSystemMessage logs as inbound)
  const isSystem = msg.includes("系统通知：") || msg.startsWith("\n[首次接触");
  if (isSystem) {
    const match = msg.match(/系统通知：([\s\S]*?)(?:\n\n工单信息|$)/);
    if (match) {
      return { text: match[1].trim(), isSystemEvent: true };
    }
  }

  if (direction === "inbound") {
    // Strip injected prefixes from inbound messages
    const cleaned = msg
      .replace(/^\[当前时间:.*?\]\n/m, "")
      .replace(/^\[师傅:.*?\]\n/m, "")
      .replace(/^\[首次接触.*?\]\n/m, "")
      .replace(/^\[该师傅的历史记忆\][\s\S]*?\n\n/m, "")
      .replace(/^\[当前活跃工单\][\s\S]*?\n\n/m, "")
      .replace(/^\[相关工单ID:.*?\]\n/m, "")
      .replace(/^\[首次接触[^\]]*\]\n/m, "")
      .replace(/^工单信息：[\s\S]*$/m, "")
      .trim();
    if (!cleaned) return { text: msg.trim(), isSystemEvent: true };
    return { text: cleaned, isSystemEvent: false };
  }

  return { text: msg, isSystemEvent: false };
}

function formatQuoteDetails(input: Record<string, unknown>): string {
  const hours = input.labor_hours as number || 0;
  const rate = input.labor_rate as number || 0;
  const laborCost = hours * rate;
  const materials = (input.materials as Array<{ name: string; quantity: number; unit_price: number }>) || [];
  const materialsCost = materials.reduce((sum, m) => sum + m.quantity * m.unit_price, 0);
  const otherCost = (input.other_cost as number) || 0;
  const total = laborCost + materialsCost + otherCost;

  const lines = [`总计: $${total}`];
  if (hours > 0) lines.push(`人工: ${hours}h x $${rate}/h = $${laborCost}`);
  if (materials.length > 0) {
    const matLines = materials.map(m => `${m.name} x${m.quantity} $${m.unit_price}`).join(", ");
    lines.push(`材料: ${matLines} = $${materialsCost}`);
  }
  if (otherCost > 0) {
    lines.push(`其他: $${otherCost} ${input.other_description || ""}`);
  }
  if (input.estimated_completion) {
    lines.push(`预计完工: ${input.estimated_completion}`);
  }
  return lines.join("\n");
}

function ToolTag({ tc, expanded, onToggle }: {
  tc: { name: string; input: Record<string, unknown> };
  expanded: boolean;
  onToggle: () => void;
}) {
  const config = TOOL_LABELS[tc.name] || { label: tc.name, color: "bg-gray-50 text-gray-600 border-gray-200" };
  const isExpandable = tc.name === "submit_quote" || tc.name === "notify_pm";

  let label = config.label;
  if (tc.name === "submit_quote") {
    const hours = (tc.input.labor_hours as number) || 0;
    const rate = (tc.input.labor_rate as number) || 0;
    const materials = (tc.input.materials as Array<{ quantity: number; unit_price: number }>) || [];
    const matCost = materials.reduce((s, m) => s + m.quantity * m.unit_price, 0);
    const total = hours * rate + matCost + ((tc.input.other_cost as number) || 0);
    label = `提交报价 $${total}`;
  }
  if (tc.name === "notify_pm" && tc.input.reason) {
    label = `通知PM: ${(tc.input.reason as string).slice(0, 30)}`;
  }

  return (
    <div>
      <button
        onClick={isExpandable ? onToggle : undefined}
        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border ${config.color} ${
          isExpandable ? "cursor-pointer hover:opacity-80" : "cursor-default"
        }`}
      >
        {label}
        {isExpandable && (
          <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {expanded && tc.name === "submit_quote" && (
        <pre className="mt-1 text-xs text-gray-600 bg-gray-50 rounded p-2 whitespace-pre-wrap">
          {formatQuoteDetails(tc.input)}
        </pre>
      )}
      {expanded && tc.name === "notify_pm" && (
        <div className="mt-1 text-xs text-orange-700 bg-orange-50 rounded p-2">
          {tc.input.urgency === "urgent" && <span className="font-bold">紧急 </span>}
          {tc.input.reason as string}
        </div>
      )}
    </div>
  );
}

type AgentStatus = "error" | "attention" | "normal" | "done";

const AGENT_STATUS_CONFIG: Record<AgentStatus, { label: string; dotColor: string; bg: string; text: string }> = {
  error:     { label: "异常",   dotColor: "bg-[#DC2626]", bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]" },
  attention: { label: "需介入", dotColor: "bg-[#EA580C]", bg: "bg-[#FFF7ED]", text: "text-[#C2410C]" },
  normal:    { label: "正常",   dotColor: "bg-[#16A34A]", bg: "bg-[#F0FDF4]", text: "text-[#15803D]" },
  done:      { label: "已完成", dotColor: "bg-[#9CA3AF]", bg: "bg-[#F9FAFB]", text: "text-[#6B7280]" },
};

function deriveSessionStatus(
  confirmed: boolean,
  messages: Message[],
  workOrders: WorkOrder[],
): AgentStatus {
  // All work orders done/cancelled → session complete
  const activeWOs = workOrders.filter(
    (wo) => wo.status !== "completed" && wo.status !== "cancelled",
  );
  if (activeWOs.length === 0) return "done";

  // Check for recent escalation (notify_pm in last 10 messages)
  const recentMessages = messages.slice(-10);
  const hasRecentEscalation = recentMessages.some(
    (m) => m.tool_calls?.some((tc) => tc.name === "notify_pm"),
  );
  if (hasRecentEscalation) return "error";

  // Unconfirmed or waiting for reply
  if (!confirmed) return "attention";
  const lastMsg = messages[messages.length - 1];
  if (lastMsg?.direction === "outbound") return "attention";

  return "normal";
}

export default function AgentSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [contractor, setContractor] = useState<ContractorInfo | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [sessionInfo, setSessionInfo] = useState<{ status: string; confirmed: boolean; created_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [woFilter, setWoFilter] = useState<string>("all");
  const [agentName, setAgentName] = useState("小栖");

  useEffect(() => {
    if (!sessionId) return;

    async function load() {
      try {
        const filterParam = woFilter === "all" ? undefined : woFilter;
        const res = await api.getAgentSession(sessionId, filterParam);
        const data = res.data as {
          session: { status: string; confirmed: boolean; created_at: string };
          contractor: ContractorInfo | null;
          messages: Message[];
          memories: Memory[];
          work_orders: WorkOrder[];
        };

        setSessionInfo(data.session);
        setContractor(data.contractor);
        setMessages(data.messages);
        setMemories(data.memories);
        setWorkOrders(data.work_orders);
      } catch {
        // session not found
      }
      setLoading(false);
    }

    load();
  }, [sessionId, woFilter]);

  // Fetch agent config for name display
  useEffect(() => {
    api.getAgentConfig()
      .then((res) => {
        if (res.data.agent_name) setAgentName(res.data.agent_name);
      })
      .catch(() => {});
  }, []);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function toggleTool(id: string) {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Build work order ID → short address lookup for message labels
  const woLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const wo of workOrders) {
      const short = wo.address.length > 20 ? wo.address.slice(0, 20) + "..." : wo.address;
      map.set(wo.id, short);
    }
    return map;
  }, [workOrders]);

  if (loading) {
    return (
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 border-b border-gray-200 shrink-0" />
          <div className="flex-1 p-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                <div className={`h-10 rounded-lg bg-gray-100 animate-pulse ${i % 2 === 0 ? "w-48" : "w-56"}`} />
              </div>
            ))}
          </div>
        </div>
        <div className="w-64 border-l border-gray-200 bg-gray-50 shrink-0 p-4 space-y-4">
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-5 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mt-4" />
          <div className="h-16 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: Conversation timeline */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-12 flex items-center gap-3 px-4 border-b border-gray-200 shrink-0">
          <button
            onClick={() => router.push("/dashboard/agent")}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-medium text-sm">{contractor?.name || "对话详情"}</span>
          {sessionInfo && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              sessionInfo.status === "active" ? "text-green-700 bg-green-50" : "text-gray-500 bg-gray-100"
            }`}>
              {sessionInfo.status === "active" ? "活跃" : "已过期"}
            </span>
          )}
          {workOrders.length > 1 && (
            <select
              value={woFilter}
              onChange={(e) => { setLoading(true); setWoFilter(e.target.value); }}
              className="ml-auto text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:border-gray-400"
            >
              <option value="all">全部工单</option>
              {workOrders.map((wo) => (
                <option key={wo.id} value={wo.id}>
                  {wo.address.length > 25 ? wo.address.slice(0, 25) + "..." : wo.address}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.length === 0 ? (
            <div className="text-gray-400 text-sm text-center mt-8">暂无对话记录</div>
          ) : (
            messages.map((msg) => {
              const { text, isSystemEvent } = cleanMessage(msg.message, msg.direction);

              if (isSystemEvent) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="text-xs text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-2.5 py-1.5 max-w-md text-center">
                      <span className="text-gray-400 mr-2">{formatTime(msg.created_at)}</span>
                      {text}
                    </div>
                  </div>
                );
              }

              const isInbound = msg.direction === "inbound";
              const { cleanText, photoUrls } = extractPhotos(text);

              // Hide "[tool call]" placeholder — only show tool tags
              const displayText = cleanText === "[tool call]" ? "" : cleanText;

              // Skip messages with no text, no photos, and no tool calls
              if (!displayText && photoUrls.length === 0 && (!msg.tool_calls || msg.tool_calls.length === 0)) {
                return null;
              }

              return (
                <div key={msg.id} className={`flex items-end gap-1.5 ${isInbound ? "justify-start" : "justify-end"}`}>
                  <div className="max-w-[70%] space-y-1">
                    {displayText && (
                      <div className={`rounded-lg px-2.5 py-1.5 text-sm ${
                        isInbound
                          ? "bg-gray-100 text-gray-900"
                          : "bg-blue-50 text-gray-900"
                      }`}>
                        <p className="whitespace-pre-wrap">{displayText}</p>
                      </div>
                    )}

                    {/* Photo thumbnails */}
                    {photoUrls.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {photoUrls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                            <img
                              src={url}
                              alt={`照片 ${i + 1}`}
                              className="w-32 h-24 object-cover rounded-lg border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Tool calls */}
                    {msg.tool_calls && msg.tool_calls.length > 0 && (
                      <div className={`flex flex-wrap gap-1 ${isInbound ? "" : "justify-end"}`}>
                        {msg.tool_calls.map((tc, i) => (
                          <ToolTag
                            key={`${msg.id}-${i}`}
                            tc={tc}
                            expanded={expandedTools.has(`${msg.id}-${i}`)}
                            onToggle={() => toggleTool(`${msg.id}-${i}`)}
                          />
                        ))}
                      </div>
                    )}

                    <div className={`text-[10px] text-gray-400 flex items-center gap-1.5 ${isInbound ? "" : "justify-end"}`}>
                      <span>{isInbound ? "师傅" : "龙虾"} {formatTime(msg.created_at)}</span>
                      {msg.work_order_id && woFilter === "all" && workOrders.length > 1 && woLabelMap.has(msg.work_order_id) && (
                        <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[150px]">
                          {woLabelMap.get(msg.work_order_id)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Sidebar */}
      <div className="w-64 border-l border-gray-200 bg-gray-50 overflow-y-auto shrink-0">
        <div className="p-4 space-y-4">
          {/* Contractor info */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">师傅信息</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">姓名</span>
                <span className="font-medium">{contractor?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">手机</span>
                <span className="font-medium">{contractor?.phone}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">状态</span>
                {(() => {
                  const status = deriveSessionStatus(
                    sessionInfo?.confirmed ?? false,
                    messages,
                    workOrders,
                  );
                  const config = AGENT_STATUS_CONFIG[status];
                  const isActive = status !== "done";
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                      <span className="relative flex h-2 w-2">
                        {isActive && (
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dotColor}`} />
                        )}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
                      </span>
                      {config.label}
                    </span>
                  );
                })()}
              </div>
              {sessionInfo?.created_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">首次接触</span>
                  <span className="text-gray-700">{formatTime(sessionInfo.created_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Memories */}
          {memories.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">师傅画像</h3>
              <div className="space-y-2">
                {memories.map((m) => (
                  <div key={m.key} className="bg-white rounded border border-gray-200 p-2">
                    <div className="text-xs font-medium text-gray-600 mb-0.5">{m.key}</div>
                    <div className="text-xs text-gray-500">{m.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Work orders */}
          {workOrders.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">关联工单</h3>
              <div className="space-y-2">
                {workOrders.map((wo) => (
                  <button
                    key={wo.id}
                    onClick={() => router.push(`/dashboard/work-orders?selected=${wo.id}`)}
                    className="w-full text-left bg-white rounded border border-gray-200 p-2 hover:border-blue-300 transition-colors"
                  >
                    <div className="text-xs font-medium text-gray-700 truncate">{wo.address}</div>
                    <div className="text-xs text-gray-500 truncate">{wo.description}</div>
                    <span className="text-[10px] text-gray-400">{wo.status}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
