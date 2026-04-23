"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface SessionRow {
  id: string;
  session_id: string;
  contractor_id: string;
  status: string;
  confirmed: boolean;
  created_at: string;
  contractor_name: string;
  contractor_phone: string;
  last_message: string | null;
  last_message_direction: string | null;
  last_message_at: string | null;
  active_work_orders: number;
  total_work_orders: number;
  work_order_summary: { address: string; description: string } | null;
  has_escalation: boolean;
}

type AgentStatus = "error" | "attention" | "normal" | "done";

// 4-color system: 红(异常) 橙(需介入) 绿(正常) 灰(完成)
const AGENT_STATUS_CONFIG: Record<AgentStatus, { label: string; dotColor: string; bg: string; text: string }> = {
  error:     { label: "异常",   dotColor: "bg-[#DC2626]", bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]" },
  attention: { label: "需介入", dotColor: "bg-[#EA580C]", bg: "bg-[#FFF7ED]", text: "text-[#C2410C]" },
  normal:    { label: "正常",   dotColor: "bg-[#16A34A]", bg: "bg-[#F0FDF4]", text: "text-[#15803D]" },
  done:      { label: "已完成", dotColor: "bg-[#9CA3AF]", bg: "bg-[#F9FAFB]", text: "text-[#6B7280]" },
};

const STATUS_OPTIONS: { key: AgentStatus | "all"; label: string }[] = [
  { key: "all", label: "全部状态" },
  { key: "error", label: "异常" },
  { key: "attention", label: "需介入" },
  { key: "normal", label: "正常" },
  { key: "done", label: "已完成" },
];

const TIME_OPTIONS: { key: string; label: string; days: number | null }[] = [
  { key: "all", label: "全部时间", days: null },
  { key: "7d", label: "最近 7 天", days: 7 },
  { key: "30d", label: "最近 30 天", days: 30 },
];

function deriveStatus(s: SessionRow): AgentStatus {
  if (s.has_escalation) return "error";
  if (s.active_work_orders === 0 && s.total_work_orders > 0) return "done";
  if (!s.confirmed) return "attention";
  if (s.last_message_direction === "outbound") return "attention";
  return "normal";
}

function AgentStatusBadge({ status }: { status: AgentStatus }) {
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
}

function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  multiple,
}: {
  label: string;
  value: Set<T> | T;
  options: { key: T; label: string }[];
  onChange: (key: T) => void;
  multiple?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayLabel = multiple
    ? (value as Set<T>).has("all" as T)
      ? options[0].label
      : [...(value as Set<T>)].map((v) => options.find((o) => o.key === v)?.label).join(", ")
    : options.find((o) => o.key === (value as T))?.label || "";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors"
      >
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-900">{displayLabel}</span>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
          {options.map((opt) => {
            const isSelected = multiple
              ? (value as Set<T>).has(opt.key)
              : (value as T) === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => {
                  onChange(opt.key);
                  if (!multiple) setOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
              >
                <span className={isSelected ? "text-gray-900 font-medium" : "text-gray-600"}>{opt.label}</span>
                {isSelected && (
                  <span className="w-4 h-4 rounded-full border-2 border-gray-900 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-gray-900" />
                  </span>
                )}
                {!isSelected && (
                  <span className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AgentPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Set<AgentStatus | "all">>(new Set(["all"]));
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.listAgentSessions()
      .then((res) => setSessions(res.data as SessionRow[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sessionsWithStatus = useMemo(
    () => sessions.map((s) => ({ ...s, derivedStatus: deriveStatus(s) })),
    [sessions],
  );

  const filtered = useMemo(() => {
    const timeDays = TIME_OPTIONS.find((t) => t.key === timeFilter)?.days;
    const cutoff = timeDays ? new Date(Date.now() - timeDays * 86400000) : null;

    return sessionsWithStatus.filter((s) => {
      if (!statusFilter.has("all") && !statusFilter.has(s.derivedStatus)) return false;
      if (search && !s.contractor_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (cutoff) {
        const sessionTime = new Date(s.last_message_at || s.created_at);
        if (sessionTime < cutoff) return false;
      }
      return true;
    });
  }, [sessionsWithStatus, statusFilter, timeFilter, search]);

  function toggleStatusFilter(key: AgentStatus | "all") {
    setStatusFilter((prev) => {
      if (key === "all") return new Set(["all"]);
      const next = new Set(prev);
      next.delete("all");
      if (next.has(key)) {
        next.delete(key);
        if (next.size === 0) return new Set(["all"]);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}小时前`;
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  }

  if (loading) {
    return (
      <div className="flex-1 p-6 overflow-auto">
        <h1 className="text-xl font-bold mb-1">智能体管理</h1>
        <p className="text-sm text-gray-500 mb-4">龙虾与师傅的对话记录和状态</p>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
              <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="h-5 w-12 bg-gray-100 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-auto">
      <h1 className="text-xl font-bold mb-1">智能体管理</h1>
      <p className="text-sm text-gray-500 mb-4">龙虾与师傅的对话记录和状态</p>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Dropdown
          label="状态"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={toggleStatusFilter}
          multiple
        />
        <Dropdown
          label="时间"
          value={timeFilter}
          options={TIME_OPTIONS}
          onChange={(key) => setTimeFilter(key)}
        />
        <div className="ml-auto">
          <input
            type="text"
            placeholder="搜索师傅..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-gray-400 w-48"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-gray-400 text-sm py-8 text-center">
          {sessions.length === 0 ? "暂无对话记录" : "没有匹配的结果"}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">师傅</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">状态</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">关联工单</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">最新动态</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">最后活跃</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => router.push(`/dashboard/agent/session/${s.session_id}`)}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-gray-900">{s.contractor_name}</div>
                    <div className="text-xs text-gray-400">{s.contractor_phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <AgentStatusBadge status={s.derivedStatus} />
                  </td>
                  <td className="px-4 py-3">
                    {s.work_order_summary ? (
                      <div>
                        <div className="text-sm text-gray-700 truncate max-w-[200px]">{s.work_order_summary.address}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[200px]">{s.work_order_summary.description}</div>
                        {s.total_work_orders > 1 && (
                          <span className="text-xs text-gray-400">+{s.total_work_orders - 1} 个工单</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">无</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.last_message ? (
                      <p className="text-sm text-gray-500 truncate max-w-[250px]">{s.last_message.slice(0, 80)}</p>
                    ) : (
                      <span className="text-xs text-gray-300">无消息</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-gray-400">
                      {s.last_message_at ? formatTime(s.last_message_at) : formatTime(s.created_at)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
