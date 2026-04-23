"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { WorkOrderStatus } from "@/types";
import { getStatusConfig } from "./status-badge";
import { KanbanCard, KanbanWorkOrder } from "./kanban-card";

type DropValidity = "valid" | "invalid" | "same" | null;

export function KanbanColumn({
  status,
  workOrders,
  onCardClick,
  dropValidity,
  isDragTarget,
}: {
  status: WorkOrderStatus;
  workOrders: KanbanWorkOrder[];
  onCardClick: (id: string) => void;
  dropValidity?: DropValidity;
  isDragTarget?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = getStatusConfig(status);
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        className="flex flex-col items-center w-10 shrink-0 rounded-md bg-white/50 cursor-pointer hover:bg-[#F1F3F5] transition-colors"
        onClick={() => setCollapsed(false)}
        title={`展开「${config.label}」`}
      >
        <div className="py-3 flex flex-col items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${config.dot}`} />
          <span className="text-xs text-gray-400 font-mono">{workOrders.length}</span>
          <span className="text-xs text-gray-500 font-medium writing-mode-vertical" style={{ writingMode: "vertical-rl" }}>
            {config.label}
          </span>
        </div>
      </div>
    );
  }

  // Determine column background based on drag state
  const getColumnBg = () => {
    if (!dropValidity || dropValidity === "same") return "";
    if (isDragTarget && isOver) {
      // Actively hovering over this column
      return dropValidity === "valid"
        ? "bg-emerald-50 ring-2 ring-emerald-300 ring-inset"
        : "bg-red-50 ring-2 ring-red-300 ring-inset";
    }
    // Not hovering but dragging — show subtle hint
    if (dropValidity === "valid") return "bg-emerald-50/40";
    if (dropValidity === "invalid") return "opacity-50";
    return "";
  };

  return (
    <div
      className={`flex flex-col min-w-[280px] w-[280px] shrink-0 ${getColumnBg()} rounded-md transition-all duration-150`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-2 py-2 sticky top-0 bg-[#F8F9FA] z-10">
        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
        <span className="text-sm font-medium text-gray-700">{config.label}</span>
        <span className="text-xs text-gray-400 font-mono">({workOrders.length})</span>
        <button
          onClick={(e) => { e.stopPropagation(); setCollapsed(true); }}
          className="ml-auto text-gray-300 hover:text-gray-500 transition-colors"
          title={`折叠「${config.label}」`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Cards container */}
      <div
        ref={setNodeRef}
        className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto min-h-[100px]"
      >
        <SortableContext items={workOrders.map((wo) => wo.id)} strategy={verticalListSortingStrategy}>
          {workOrders.map((wo) => (
            <KanbanCard
              key={wo.id}
              workOrder={wo}
              onClick={() => onCardClick(wo.id)}
            />
          ))}
        </SortableContext>

        {workOrders.length === 0 && (
          <div className="flex items-center justify-center h-20 border border-dashed border-gray-200 rounded-md">
            <span className="text-xs text-gray-300">暂无工单</span>
          </div>
        )}
      </div>
    </div>
  );
}
