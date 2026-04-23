"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CATEGORY_LABELS } from "@/lib/labels";
import { Category } from "@/types";
import type { ContractorWithStats } from "@/types";

export function AssignContractorModal({
  pmId,
  workOrderCategory,
  onAssign,
  onClose,
}: {
  pmId: string;
  workOrderCategory?: string;
  onAssign: (contractorId: string) => void;
  onClose: () => void;
}) {
  const [contractors, setContractors] = useState<ContractorWithStats[]>([]);
  const [search, setSearch] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>(
    workOrderCategory || "all",
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    api
      .listContractors()
      .then((res) => {
        setContractors(res.data as ContractorWithStats[]);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [pmId]);

  // Filter and sort
  let filtered = contractors;

  if (specialtyFilter !== "all") {
    filtered = filtered.filter((c) =>
      c.specialties?.includes(specialtyFilter as Category),
    );
  }

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q),
    );
  }

  // Sort: favorites first, then by rating desc
  filtered = [...filtered].sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) return b.is_favorite ? 1 : -1;
    const ratingA = a.stats?.avg_rating ?? 0;
    const ratingB = b.stats?.avg_rating ?? 0;
    return ratingB - ratingA;
  });

  const favorites = filtered.filter((c) => c.is_favorite);
  const others = filtered.filter((c) => !c.is_favorite);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg border border-[#E5E7EB] w-[440px] max-h-[560px] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-semibold text-gray-900">选择师傅</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#F1F3F5] text-gray-400"
          >
            ✕
          </button>
        </div>

        {/* Search + filter */}
        <div className="px-4 py-2 border-b border-[#F3F4F6] flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索师傅..."
            className="flex-1 h-9 px-3 border border-[#E5E7EB] rounded-md text-sm
                       focus:outline-none focus:border-brand-600 focus:shadow-[var(--shadow-focus)]
                       placeholder:text-gray-400"
            autoFocus
          />
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="h-9 px-2 border border-[#E5E7EB] rounded-md text-xs bg-white
                       focus:outline-none focus:border-brand-600"
          >
            <option value="all">全部专长</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-20 text-sm text-gray-400">
              加载中...
            </div>
          ) : loadError ? (
            <div className="flex items-center justify-center h-20 text-sm text-red-500">
              加载失败，请关闭后重试
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-sm text-gray-400">
              {contractors.length === 0
                ? "暂无工人，请先添加"
                : "没有匹配的结果"}
            </div>
          ) : (
            <>
              {favorites.length > 0 && (
                <div className="px-4 pt-2 pb-1">
                  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                    常用
                  </span>
                </div>
              )}
              {favorites.map((c) => (
                <ContractorRow
                  key={c.id}
                  contractor={c}
                  onAssign={onAssign}
                />
              ))}
              {others.length > 0 && favorites.length > 0 && (
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                    其他
                  </span>
                </div>
              )}
              {others.map((c) => (
                <ContractorRow
                  key={c.id}
                  contractor={c}
                  onAssign={onAssign}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ContractorRow({
  contractor: c,
  onAssign,
}: {
  contractor: ContractorWithStats;
  onAssign: (id: string) => void;
}) {
  const stats = c.stats;
  return (
    <button
      onClick={() => onAssign(c.id)}
      className="w-full flex items-start justify-between px-4 py-3 hover:bg-[#F1F3F5] transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {c.is_favorite && (
            <span className="text-amber-500 text-xs">★</span>
          )}
          <span className="text-sm font-medium text-gray-900">{c.name}</span>
          {stats?.avg_rating != null && (
            <span className="text-xs text-gray-500">
              <span className="text-amber-500">★</span>
              {stats.avg_rating.toFixed(1)}
            </span>
          )}
          <span className="text-xs text-gray-400">
            {stats?.total_completed ?? 0}单
          </span>
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {c.specialties?.map((s) => (
            <span
              key={s}
              className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-gray-500"
            >
              {CATEGORY_LABELS[s] ?? s}
            </span>
          ))}
        </div>
        {/* Stats line */}
        {(stats?.avg_quote != null || stats?.avg_completion_days != null) && (
          <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
            {stats.avg_quote != null && (
              <span>均价${Math.round(stats.avg_quote)}</span>
            )}
            {stats.avg_completion_days != null && (
              <span>均时{stats.avg_completion_days}天</span>
            )}
          </div>
        )}
      </div>
      <span className="text-xs text-brand-600 font-medium shrink-0 mt-1">
        指派
      </span>
    </button>
  );
}
