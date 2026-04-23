"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { CATEGORY_LABELS } from "@/lib/labels";
import { Category } from "@/types";
import type {
  ContractorWithStats,
  ContractorNote,
  ContractorRating,
  WorkOrder,
} from "@/types";

type SpecialtyFilter = Category | "all";

interface PMCodeData {
  code: string;
  share_url: string;
}

interface ContractorDetail extends ContractorWithStats {
  work_orders: WorkOrder[];
  ratings: ContractorRating[];
  notes: ContractorNote[];
}

// ── Status helpers (copied from detail page) ─────────────────

const STATUS_COLORS: Record<string, string> = {
  pending_assignment: "bg-gray-100 text-gray-600",
  assigned: "bg-blue-50 text-blue-600",
  quoting: "bg-purple-50 text-purple-600",
  pending_approval: "bg-amber-50 text-amber-600",
  in_progress: "bg-cyan-50 text-cyan-600",
  pending_verification: "bg-orange-50 text-orange-600",
  completed: "bg-green-50 text-green-600",
  cancelled: "bg-red-50 text-red-600",
  on_hold: "bg-yellow-50 text-yellow-700",
};

const STATUS_TEXT: Record<string, string> = {
  pending_assignment: "待派单",
  assigned: "已派单",
  quoting: "报价中",
  pending_approval: "待审批",
  in_progress: "施工中",
  pending_verification: "待验收",
  completed: "已完成",
  cancelled: "已取消",
  on_hold: "已挂起",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[status] || "bg-gray-100 text-gray-600"}`}
    >
      {STATUS_TEXT[status] || status}
    </span>
  );
}

// ── StatCard helper ──────────────────────────────────────────

function StatCard({
  label,
  value,
  unit,
  icon,
  iconColor,
}: {
  label: string;
  value: string;
  unit?: string;
  icon?: string;
  iconColor?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="flex items-center justify-center gap-1">
        {icon && <span className={iconColor || ""}>{icon}</span>}
        <span className="text-lg font-bold text-gray-900">{value}</span>
        {unit && <span className="text-xs text-gray-400">{unit}</span>}
      </div>
      <p className="text-[10px] text-gray-500 mt-1">{label}</p>
    </div>
  );
}

// ── ContractorSlideOut ───────────────────────────────────────

function ContractorSlideOut({
  contractorId,
  onClose,
}: {
  contractorId: string;
  onClose: () => void;
}) {
  const [contractor, setContractor] = useState<ContractorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Specialties editing state
  const [editingSpecialties, setEditingSpecialties] = useState(false);
  const [selectedSpecialties, setSelectedSpecialties] = useState<Category[]>([]);
  const [savingSpecialties, setSavingSpecialties] = useState(false);

  // Notes state
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  };

  const handleSaveSpecialties = async () => {
    if (selectedSpecialties.length === 0) {
      showError("请至少选择一个专长");
      return;
    }
    setSavingSpecialties(true);
    try {
      await api.updateContractor(contractorId, { specialties: selectedSpecialties });
      setContractor((prev) =>
        prev ? { ...prev, specialties: selectedSpecialties } : prev,
      );
      setEditingSpecialties(false);
    } catch {
      showError("保存专长失败");
    } finally {
      setSavingSpecialties(false);
    }
  };

  const fetchContractor = useCallback(async () => {
    try {
      const res = await api.getContractor(contractorId);
      setContractor(res.data as ContractorDetail);
    } catch {
      // 404 or 403
    } finally {
      setLoading(false);
    }
  }, [contractorId]);

  useEffect(() => {
    fetchContractor();
  }, [fetchContractor]);

  // Slide-in animation
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Trigger the transition on next frame so CSS picks up the change
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300); // wait for transition to finish
  };

  const addNote = async () => {
    if (!contractor || !newNote.trim()) return;
    setSavingNote(true);
    try {
      await api.createContractorNote(contractor.id, newNote.trim());
      setNewNote("");
      await fetchContractor();
    } catch {
      showError("添加备注失败，请重试");
    } finally {
      setSavingNote(false);
    }
  };

  const updateNote = async (noteId: string) => {
    if (!contractor || !editingContent.trim()) return;
    try {
      await api.updateContractorNote(contractor.id, noteId, editingContent.trim());
      setEditingNoteId(null);
      setEditingContent("");
      await fetchContractor();
    } catch {
      showError("更新备注失败，请重试");
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!contractor) return;
    try {
      await api.deleteContractorNote(contractor.id, noteId);
      await fetchContractor();
    } catch {
      showError("删除备注失败，请重试");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${visible ? "opacity-30" : "opacity-0"}`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`relative w-full max-w-[520px] bg-white shadow-xl h-full overflow-auto transition-transform duration-300 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors z-10"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        )}

        {/* Not found */}
        {!loading && !contractor && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-sm text-gray-500">工人不存在或无权访问</p>
            <button
              onClick={handleClose}
              className="text-xs text-brand-600 hover:text-brand-700"
            >
              关闭
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && contractor && (() => {
          const { stats, work_orders, ratings, notes } = contractor;
          return (
            <div className="p-6">
              {/* Error banner */}
              {error && (
                <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {error}
                </div>
              )}

              {/* Header */}
              <div className="mb-5">
                <h2 className="text-lg font-bold text-gray-900">{contractor.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-xs text-gray-500">{contractor.phone}</p>
                  {contractor.email && (
                    <p className="text-xs text-gray-400">{contractor.email}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {editingSpecialties ? (
                    <>
                      {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                        const selected = selectedSpecialties.includes(key as Category);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setSelectedSpecialties((prev) =>
                                selected
                                  ? prev.filter((s) => s !== key)
                                  : [...prev, key as Category],
                              )
                            }
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                              selected
                                ? "bg-teal-500 text-white border-teal-500"
                                : "bg-white text-gray-500 border-gray-300"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={handleSaveSpecialties}
                        disabled={savingSpecialties}
                        className="text-[10px] text-teal-600 hover:text-teal-700 ml-1"
                      >
                        {savingSpecialties ? "保存中..." : "保存"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSpecialties(false)}
                        className="text-[10px] text-gray-400 hover:text-gray-500"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      {contractor.specialties.map((s) => (
                        <span
                          key={s}
                          className="text-[10px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full"
                        >
                          {CATEGORY_LABELS[s] || s}
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSpecialties([...contractor.specialties]);
                          setEditingSpecialties(true);
                        }}
                        className="text-[10px] text-gray-400 hover:text-teal-500 transition-colors"
                      >
                        编辑
                      </button>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">
                  加入时间：{new Date(contractor.created_at).toLocaleDateString("zh-CN")}
                </p>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <StatCard label="完成工单" value={String(stats.total_completed)} unit="单" />
                <StatCard
                  label="平均评分"
                  value={stats.avg_rating?.toFixed(1) ?? "—"}
                  icon="★"
                  iconColor="text-amber-500"
                />
                <StatCard
                  label="平均报价"
                  value={stats.avg_quote != null ? `$${Math.round(stats.avg_quote)}` : "—"}
                />
                <StatCard
                  label="平均完工"
                  value={stats.avg_completion_days != null ? String(stats.avg_completion_days) : "—"}
                  unit={stats.avg_completion_days != null ? "天" : undefined}
                />
              </div>

              {/* Additional stats row */}
              {(stats.rework_rate > 0 || stats.quote_variance != null) && (
                <div className="flex items-center gap-4 mb-4 px-1">
                  {stats.rework_rate > 0 && (
                    <span className="text-xs text-red-500">
                      返修率：{Math.round(stats.rework_rate * 100)}%
                    </span>
                  )}
                  {stats.quote_variance != null && (
                    <span className="text-xs text-gray-500">
                      报价偏差：{Math.round(stats.quote_variance * 100)}%
                    </span>
                  )}
                </div>
              )}

              {/* Work order history */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">历史工单</h3>
                {work_orders.length === 0 ? (
                  <p className="text-xs text-gray-400">暂无工单记录</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-200">
                          <th className="text-left py-2 pr-3 font-medium">日期</th>
                          <th className="text-left py-2 pr-3 font-medium">物业</th>
                          <th className="text-left py-2 pr-3 font-medium">类别</th>
                          <th className="text-left py-2 pr-3 font-medium">状态</th>
                          <th className="text-right py-2 font-medium">评分</th>
                        </tr>
                      </thead>
                      <tbody>
                        {work_orders
                          .sort(
                            (a, b) =>
                              new Date(b.created_at).getTime() -
                              new Date(a.created_at).getTime(),
                          )
                          .map((wo) => {
                            const rating = ratings.find(
                              (r) => r.work_order_id === wo.id,
                            );
                            return (
                              <tr
                                key={wo.id}
                                className="border-b border-gray-100 hover:bg-white/60"
                              >
                                <td className="py-2 pr-3 text-gray-500">
                                  {new Date(wo.created_at).toLocaleDateString(
                                    "zh-CN",
                                    { month: "2-digit", day: "2-digit" },
                                  )}
                                </td>
                                <td className="py-2 pr-3 text-gray-900">
                                  {wo.property_address}
                                  {wo.unit ? ` #${wo.unit}` : ""}
                                </td>
                                <td className="py-2 pr-3 text-gray-600">
                                  {CATEGORY_LABELS[wo.category] || wo.category}
                                </td>
                                <td className="py-2 pr-3">
                                  <StatusBadge status={wo.status} />
                                </td>
                                <td className="py-2 text-right">
                                  {rating ? (
                                    <span className="text-amber-500">
                                      {"★".repeat(rating.rating)}
                                    </span>
                                  ) : wo.status === "completed" ? (
                                    <span className="text-gray-300">未评分</span>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Notes section */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">备注</h3>
                <p className="text-[10px] text-gray-400 mb-3">私人备注，只有你能看到</p>

                {/* Add note */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="添加备注..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) addNote();
                    }}
                    className="flex-1 h-8 px-3 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button
                    onClick={addNote}
                    disabled={savingNote || !newNote.trim()}
                    className="h-8 px-3 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
                  >
                    添加
                  </button>
                </div>

                {/* Notes list */}
                {notes.length === 0 ? (
                  <p className="text-xs text-gray-400">暂无备注</p>
                ) : (
                  <div className="space-y-2">
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="flex items-start justify-between gap-2 p-3 bg-white rounded-lg"
                      >
                        {editingNoteId === note.id ? (
                          <div className="flex-1 flex gap-2">
                            <input
                              type="text"
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.nativeEvent.isComposing)
                                  updateNote(note.id);
                                if (e.key === "Escape") setEditingNoteId(null);
                              }}
                              className="flex-1 h-7 px-2 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                              autoFocus
                            />
                            <button
                              onClick={() => updateNote(note.id)}
                              className="text-[10px] text-brand-600 hover:text-brand-700"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingNoteId(null)}
                              className="text-[10px] text-gray-400 hover:text-gray-600"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-700">{note.content}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {new Date(note.created_at).toLocaleDateString("zh-CN")}
                                {note.updated_at !== note.created_at && " (已编辑)"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setEditingContent(note.content);
                                }}
                                className="text-[10px] text-gray-400 hover:text-gray-600"
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => deleteNote(note.id)}
                                className="text-[10px] text-red-400 hover:text-red-600"
                              >
                                删除
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<ContractorWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [specialtyFilter, setSpecialtyFilter] = useState<SpecialtyFilter>("all");
  const [search, setSearch] = useState("");
  const [pmCode, setPmCode] = useState<PMCodeData | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);

  // Add contractor modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addSpecialties, setAddSpecialties] = useState<string[]>([]);
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const fetchContractors = useCallback(async () => {
    try {
      const filters: Record<string, string> = {};
      if (specialtyFilter !== "all") {
        filters.specialty = specialtyFilter;
      }
      const res = await api.listContractors(filters);
      setContractors(res.data as ContractorWithStats[]);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [specialtyFilter]);

  useEffect(() => {
    fetchContractors();
  }, [fetchContractors]);

  const handleAddContractor = async () => {
    setAddError("");
    if (!addName.trim()) { setAddError("请输入姓名"); return; }
    if (!addPhone.trim() || addPhone.trim().length < 5) { setAddError("请输入有效的手机号"); return; }
    if (addSpecialties.length === 0) { setAddError("请至少选择一个专长"); return; }

    setAddSaving(true);
    try {
      await api.createContractor({
        name: addName.trim(),
        phone: addPhone.trim(),
        specialties: addSpecialties,
      });
      setShowAddModal(false);
      setAddName("");
      setAddPhone("");
      setAddSpecialties([]);
      setAddError("");
      fetchContractors();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "添加失败";
      setAddError(msg);
    } finally {
      setAddSaving(false);
    }
  };

  const toggleSpecialty = (key: string) => {
    setAddSpecialties((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key],
    );
  };

  // Fetch PM Code
  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      fetch("/api/pm/code", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      })
        .then((res) => res.json())
        .then((json) => { if (json.code) setPmCode(json); });
    });
  }, []);

  // Client-side filters
  let filtered = contractors;
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q),
    );
  }

  return (
    <div className="h-full overflow-auto bg-[#F8F9FA] p-6">
      <div className="max-w-[1000px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">工人管理</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="h-9 px-4 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            + 手动添加工人
          </button>
        </div>

        {/* PM Code — invite workers */}
        {pmCode && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-1">邀请工人注册</h2>
                <p className="text-xs text-gray-500">将注册码或链接分享给工人，完成注册后即可派单</p>
              </div>
              <div className="flex items-center gap-3">
                <code className="text-lg font-mono font-bold text-brand-600 tracking-widest bg-brand-50 px-4 py-2 rounded-md">
                  {pmCode.code}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pmCode.share_url);
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2000);
                  }}
                  className="h-9 px-4 bg-brand-600 text-white text-sm rounded-md
                             hover:bg-brand-700 transition-colors whitespace-nowrap"
                >
                  {codeCopied ? "已复制" : "复制注册链接"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {/* Search */}
          <input
            type="text"
            placeholder="搜索姓名或电话..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 px-3 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 w-48"
          />

          {/* Specialty filter */}
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value as SpecialtyFilter)}
            className="h-8 px-3 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 appearance-none focus:outline-none focus:ring-1 focus:ring-brand-500"
            style={{ colorScheme: "light" }}
          >
            <option value="all">全部专长</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            {contractors.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">暂无已注册工人</p>
                <p className="text-xs text-gray-400">
                  将上方注册码或链接分享给工人，他们注册后会自动出现在这里
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">没有匹配的工人</p>
            )}
          </div>
        )}

        {/* Contractor cards */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedContractorId(c.id)}
                className="w-full flex items-center gap-4 bg-white rounded-lg border border-gray-100 px-4 py-3 hover:shadow-sm hover:border-gray-200 transition-all cursor-pointer text-left"
              >
                {/* Avatar */}
                <div className="shrink-0 w-9 h-9 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-sm font-bold">
                  {c.name.charAt(0)}
                </div>

                {/* Name + Phone */}
                <div className="min-w-0 w-32 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900 truncate">{c.name}</span>
                    {!c.auth_id && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 shrink-0">未注册</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">{c.phone}</div>
                </div>

                {/* Specialties */}
                <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                  {c.specialties.map((s) => (
                    <span
                      key={s}
                      className="text-[10px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full"
                    >
                      {CATEGORY_LABELS[s] || s}
                    </span>
                  ))}
                </div>

                {/* Rating + Completed */}
                <div className="shrink-0 flex items-center gap-1 text-sm">
                  <span className="text-amber-500">★</span>
                  <span className="font-semibold text-gray-900">
                    {c.stats.avg_rating?.toFixed(1) ?? "—"}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({c.stats.total_completed} 单)
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Slide-out panel */}
      {selectedContractorId && (
        <ContractorSlideOut
          contractorId={selectedContractorId}
          onClose={() => setSelectedContractorId(null)}
        />
      )}

      {/* Add contractor modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">手动添加工人</h2>
            <p className="text-xs text-gray-500 mb-5">
              添加后工人会出现在列表中，可直接派单
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="工人姓名"
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
                <input
                  type="tel"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="+1 778 123 4567"
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  专长 <span className="text-gray-400 font-normal">(至少选一个)</span>
                </label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleSpecialty(key)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        addSpecialties.includes(key)
                          ? "bg-brand-600 text-white border-brand-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {addError && (
                <p className="text-sm text-red-500">{addError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="h-9 px-4 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAddContractor}
                  disabled={addSaving}
                  className="h-9 px-5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {addSaving ? "添加中..." : "添加"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
