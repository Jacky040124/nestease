"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WorkOrderStatus, Urgency } from "@/types";
import { StatusBadge } from "./status-badge";
import { UrgencyBadge } from "./urgency-badge";

export interface KanbanWorkOrder {
  id: string;
  status: WorkOrderStatus;
  property_address: string;
  unit: string | null;
  description: string;
  urgency: Urgency;
  contractor_id: string | null;
  contractor_name?: string;
  quote_total?: number | null;
  photos: string[];
  created_at: string;
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return `${Math.floor(days / 30)}月前`;
}

export function KanbanCard({
  workOrder,
  onClick,
}: {
  workOrder: KanbanWorkOrder;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workOrder.id, data: { workOrder } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const address = workOrder.unit
    ? `${workOrder.property_address}, ${workOrder.unit}`
    : workOrder.property_address;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`bg-white rounded-lg p-3.5 cursor-pointer select-none
                  border border-gray-200/80
                  transition-all duration-200
                  ${isDragging
                    ? "shadow-xl opacity-90 scale-[1.03] ring-2 ring-brand-200"
                    : "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)] hover:-translate-y-px"
                  }`}
    >
      {/* Top row: status + urgency */}
      <div className="flex items-center justify-between mb-2.5">
        <StatusBadge status={workOrder.status} />
        <UrgencyBadge urgency={workOrder.urgency} />
      </div>

      {/* Address */}
      <div className="text-[13px] font-semibold text-gray-900 truncate leading-snug">{address}</div>

      {/* Description */}
      <div className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{workOrder.description}</div>

      {/* Divider */}
      <div className="border-t border-gray-100 mt-3 pt-2.5" />

      {/* Bottom row: contractor + quote + time + photos */}
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <div className="flex items-center gap-2">
          {workOrder.contractor_name && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
              </svg>
              {workOrder.contractor_name}
            </span>
          )}
          {workOrder.quote_total != null && (
            <span className="font-mono text-gray-500 font-medium">${workOrder.quote_total}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span>{timeAgo(workOrder.created_at)}</span>
          {workOrder.photos.length > 0 && (
            <span className="flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
              {workOrder.photos.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
