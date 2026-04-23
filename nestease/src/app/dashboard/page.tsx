"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { StatusBadge } from "@/components/status-badge";
import { WorkOrderStatus } from "@/types";

interface DashboardWorkOrder {
  id: string;
  status: WorkOrderStatus;
  property_address: string;
  description: string;
  created_at: string;
}

interface DashboardProperty {
  id: string;
  address: string;
  unit: string | null;
  cover_image: string | null;
}

interface DashboardContractor {
  id: string;
  name: string;
  phone: string;
  specialties: string[];
}

interface AgentActivity {
  session_id: string;
  contractor_name: string;
  text: string;
  time: string;
  type: "escalation" | "quote" | "identity" | "accept" | "completion" | "general";
}

export default function DashboardOverview() {
  const { user } = useAuth();
  const [pmId, setPmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<DashboardWorkOrder[]>([]);
  const [properties, setProperties] = useState<DashboardProperty[]>([]);
  const [contractors, setContractors] = useState<DashboardContractor[]>([]);
  const [agentEscalations, setAgentEscalations] = useState(0);
  const [agentActiveSessions, setAgentActiveSessions] = useState(0);
  const [agentActivities, setAgentActivities] = useState<AgentActivity[]>([]);

  const fetchData = useCallback(async (id: string) => {
    const [woRes, propRes, conRes, sessionsRes] = await Promise.all([
      supabaseBrowser
        .from("work_order")
        .select("id, status, property_address, description, created_at")
        .eq("pm_id", id)
        .not("status", "in", '("completed","archived","cancelled")')
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseBrowser
        .from("property")
        .select("id, address, unit, cover_image")
        .eq("pm_id", id)
        .order("address")
        .limit(6),
      supabaseBrowser
        .from("contractor")
        .select("id, name, phone, specialties")
        .eq("pm_id", id)
        .order("name")
        .limit(6),
      supabaseBrowser
        .from("agent_sessions")
        .select("session_id, contractor_id, status, created_at")
        .eq("pm_id", id)
        .eq("status", "active"),
    ]);

    setWorkOrders((woRes.data || []) as DashboardWorkOrder[]);
    setProperties((propRes.data || []) as DashboardProperty[]);
    setContractors((conRes.data || []) as DashboardContractor[]);

    // Agent overview data
    const sessions = sessionsRes.data || [];
    setAgentActiveSessions(sessions.length);

    if (sessions.length === 0) {
      setAgentEscalations(0);
      setAgentActivities([]);
      return;
    }

    const sessionIds = sessions.map((s) => s.session_id);
    const contractorIds = [...new Set(sessions.map((s) => s.contractor_id))];

    // Batch: contractor names, recent tool_calls
    const [contractorsRes, toolCallsRes] = await Promise.all([
      supabaseBrowser
        .from("contractor")
        .select("id, name")
        .in("id", contractorIds),
      supabaseBrowser
        .from("agent_conversation_log")
        .select("session_id, tool_calls, created_at")
        .in("session_id", sessionIds)
        .not("tool_calls", "is", null)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const nameMap = new Map(
      (contractorsRes.data || []).map((c) => [c.id, c.name])
    );
    const sessionContractorMap = new Map(
      sessions.map((s) => [s.session_id, s.contractor_id])
    );

    // Count escalations
    const escalationSessions = new Set<string>();
    const allToolRows = toolCallsRes.data || [];
    for (const row of allToolRows) {
      if (
        Array.isArray(row.tool_calls) &&
        row.tool_calls.some((tc: { name: string }) => tc.name === "notify_pm")
      ) {
        escalationSessions.add(row.session_id);
      }
    }
    setAgentEscalations(escalationSessions.size);

    // Build recent activities from tool_calls (latest 3)
    const activities: AgentActivity[] = [];
    for (const row of allToolRows) {
      if (activities.length >= 3) break;
      if (!Array.isArray(row.tool_calls)) continue;

      const contractorId = sessionContractorMap.get(row.session_id);
      const contractorName = contractorId ? nameMap.get(contractorId) || "未知" : "未知";

      for (const tc of row.tool_calls as Array<{ name: string; input: Record<string, unknown> }>) {
        if (activities.length >= 3) break;

        let text = "";
        let type: AgentActivity["type"] = "general";

        if (tc.name === "notify_pm") {
          text = `请求你介入：${(tc.input.reason as string || "").slice(0, 40)}`;
          type = "escalation";
        } else if (tc.name === "submit_quote") {
          const hours = (tc.input.labor_hours as number) || 0;
          const rate = (tc.input.labor_rate as number) || 0;
          const mats = (tc.input.materials as Array<{ quantity: number; unit_price: number }>) || [];
          const matCost = mats.reduce((s, m) => s + m.quantity * m.unit_price, 0);
          const total = hours * rate + matCost + ((tc.input.other_cost as number) || 0);
          text = `报价已提交 $${total}，等待审批`;
          type = "quote";
        } else if (tc.name === "confirm_identity") {
          text = "身份已确认";
          type = "identity";
        } else if (tc.name === "accept_work_order") {
          text = "已接单";
          type = "accept";
        } else if (tc.name === "submit_completion") {
          text = "已提交完工报告";
          type = "completion";
        } else {
          continue;
        }

        activities.push({
          session_id: row.session_id,
          contractor_name: contractorName,
          text,
          time: row.created_at,
          type,
        });
      }
    }
    setAgentActivities(activities);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: pm } = await supabaseBrowser
        .from("pm")
        .select("id")
        .eq("auth_id", user.id)
        .single();
      if (!pm) { setLoading(false); return; }
      setPmId(pm.id);
      await fetchData(pm.id);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "早上好";
    if (h < 18) return "下午好";
    return "晚上好";
  })();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-[#F8F9FA] p-6">
      <div className="max-w-[1000px] mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-6">{greeting}</h1>

        {/* Pending work orders */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">待处理工单</h2>
            <Link href="/dashboard/work-orders" className="text-xs text-brand-600 hover:text-brand-700">
              查看全部
            </Link>
          </div>
          {workOrders.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400">暂无待处理工单</p>
              <p className="text-xs text-gray-300 mt-1">租户通过报修链接提交后会出现在这里</p>
            </div>
          ) : (
            <div className="space-y-2">
              {workOrders.map((wo) => (
                <div key={wo.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{wo.property_address}</div>
                    <div className="text-xs text-gray-500 truncate">{wo.description}</div>
                  </div>
                  <StatusBadge status={wo.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent overview */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-900">龙虾动态</h2>
              <div className="flex items-center gap-4 text-xs">
                {agentEscalations > 0 && (
                  <span className="text-red-600 font-medium">
                    {agentEscalations} 个需介入
                  </span>
                )}
                <span className="text-gray-400">
                  {agentActiveSessions} 个活跃对话
                </span>
              </div>
            </div>
            <Link href="/dashboard/agent" className="text-xs text-brand-600 hover:text-brand-700">
              查看全部
            </Link>
          </div>
          {agentActivities.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400">暂无龙虾动态</p>
              <p className="text-xs text-gray-300 mt-1">龙虾与师傅对话后动态会出现在这里</p>
            </div>
          ) : (
            <div className="space-y-2">
              {agentActivities.map((a, i) => {
                // 4-color: 红(异常/escalation) 橙(需介入/quote等待审批) 绿(正常推进) 灰(完成)
                const statusConfig = a.type === "escalation"
                  ? { dot: "bg-[#DC2626]", bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", label: "异常" }
                  : a.type === "completion"
                  ? { dot: "bg-[#9CA3AF]", bg: "bg-[#F9FAFB]", text: "text-[#6B7280]", label: "完工" }
                  : a.type === "quote"
                  ? { dot: "bg-[#EA580C]", bg: "bg-[#FFF7ED]", text: "text-[#C2410C]", label: "报价" }
                  : { dot: "bg-[#16A34A]", bg: "bg-[#F0FDF4]", text: "text-[#15803D]", label: "正常" };

                const isActive = a.type !== "completion";

                return (
                  <Link
                    key={i}
                    href={`/dashboard/agent/session/${a.session_id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusConfig.bg} ${statusConfig.text}`}>
                      <span className="relative flex h-2 w-2">
                        {isActive && (
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusConfig.dot}`} />
                        )}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${statusConfig.dot}`} />
                      </span>
                      {statusConfig.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900">{a.contractor_name}</span>
                      <span className="text-sm text-gray-500 ml-2">{a.text}</span>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(a.time).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Properties */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">物业</h2>
              <Link href="/dashboard/properties" className="text-xs text-brand-600 hover:text-brand-700">
                管理物业
              </Link>
            </div>
            {properties.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400">暂无物业</p>
                <Link href="/dashboard/properties" className="text-xs text-brand-600 mt-1 inline-block">
                  添加物业 →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {properties.map((p) => (
                  <Link
                    key={p.id}
                    href={`/dashboard/properties/${p.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {p.cover_image ? (
                      <img src={p.cover_image} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-brand-50 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{p.address}</div>
                      {p.unit && <div className="text-xs text-gray-400">Unit {p.unit}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Contractors */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">工人</h2>
              <Link href="/dashboard/contractors" className="text-xs text-brand-600 hover:text-brand-700">
                管理工人
              </Link>
            </div>
            {contractors.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400">暂无工人</p>
                <Link href="/dashboard/contractors" className="text-xs text-brand-600 mt-1 inline-block">
                  邀请工人 →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {contractors.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/contractors/${c.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold shrink-0">
                      {c.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-400">{c.phone}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
