"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { WorkOrderStatus } from "@/types";
import { isValidTransition } from "@/types";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard, KanbanWorkOrder } from "./kanban-card";
import { getStatusLabel } from "./status-badge";

type DropValidity = "valid" | "invalid" | "same" | null;

// The 7 kanban columns (excluding Cancelled and OnHold — those are exception states)
const KANBAN_COLUMNS: WorkOrderStatus[] = [
  WorkOrderStatus.PendingAssignment,
  WorkOrderStatus.Assigned,
  WorkOrderStatus.Quoting,
  WorkOrderStatus.PendingApproval,
  WorkOrderStatus.InProgress,
  WorkOrderStatus.PendingVerification,
  WorkOrderStatus.Completed,
];

// Map drag destination to transition action
function getDragAction(from: WorkOrderStatus, to: WorkOrderStatus): string | null {
  const mapping: Record<string, string> = {
    [`${WorkOrderStatus.PendingAssignment}→${WorkOrderStatus.Assigned}`]: "pm_assign_contractor",
    [`${WorkOrderStatus.Assigned}→${WorkOrderStatus.Quoting}`]: "contractor_start_quote",
    [`${WorkOrderStatus.PendingApproval}→${WorkOrderStatus.InProgress}`]: "owner_approve",
    [`${WorkOrderStatus.PendingApproval}→${WorkOrderStatus.PendingAssignment}`]: "owner_reject",
    [`${WorkOrderStatus.InProgress}→${WorkOrderStatus.PendingVerification}`]: "contractor_submit_completion",
    [`${WorkOrderStatus.PendingVerification}→${WorkOrderStatus.Completed}`]: "tenant_confirm",
  };
  return mapping[`${from}→${to}`] ?? null;
}

// Contextual hints for transitions that can't be done via drag
function getDragHint(_from: WorkOrderStatus, to: WorkOrderStatus): string {
  switch (to) {
    case WorkOrderStatus.Quoting:
      return "报价需要由 Contractor 在报价表单中提交";
    case WorkOrderStatus.PendingApproval:
      return "报价提交后自动进入待审批状态";
    case WorkOrderStatus.PendingVerification:
      return "完工报告需要由 Contractor 在完工表单中提交";
    case WorkOrderStatus.Completed:
      return "需要租户确认完工或等待自动超时确认";
    default:
      return "该操作不支持拖拽，请在详情面板中操作";
  }
}

export function KanbanBoard({
  workOrders,
  onTransition,
  onCardClick,
  onAssignContractor,
  onBackgroundClick,
}: {
  workOrders: KanbanWorkOrder[];
  onTransition: (workOrderId: string, action: string) => Promise<boolean>;
  onCardClick: (id: string) => void;
  onAssignContractor: (workOrderId: string) => void;
  onBackgroundClick?: () => void;
}) {
  const [activeCard, setActiveCard] = useState<KanbanWorkOrder | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<WorkOrderStatus | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const wo = event.active.data.current?.workOrder as KanbanWorkOrder | undefined;
    setActiveCard(wo ?? null);
    setDragOverColumn(null);
  };

  // Resolve over.id to a column status
  const resolveTargetStatus = useCallback((overId: string | number): WorkOrderStatus | null => {
    const asStatus = overId as WorkOrderStatus;
    if (KANBAN_COLUMNS.includes(asStatus)) return asStatus;
    const targetCard = workOrders.find((w) => w.id === overId);
    return targetCard ? targetCard.status : null;
  }, [workOrders]);

  // Compute drop validity for a column given the active card
  const getDropValidity = useCallback((columnStatus: WorkOrderStatus): DropValidity => {
    if (!activeCard) return null;
    if (activeCard.status === columnStatus) return "same";
    if (!isValidTransition(activeCard.status, columnStatus)) return "invalid";
    const action = getDragAction(activeCard.status, columnStatus);
    if (!action) return "invalid"; // valid transition but not draggable
    return "valid";
  }, [activeCard]);

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null);
    setDragOverColumn(null);
    const { active, over } = event;
    if (!over) return;

    const wo = active.data.current?.workOrder as KanbanWorkOrder | undefined;
    if (!wo) return;

    // over.id can be a column status or a card ID — resolve to status
    let targetStatus = over.id as WorkOrderStatus;
    if (!KANBAN_COLUMNS.includes(targetStatus)) {
      // Dropped on a card — find its column
      const targetCard = workOrders.find((w) => w.id === over.id);
      if (targetCard) {
        targetStatus = targetCard.status;
      } else {
        return; // unknown target
      }
    }
    if (wo.status === targetStatus) return;

    // Check if this is a valid transition
    if (!isValidTransition(wo.status, targetStatus)) {
      showToast(`不能将工单从「${getStatusLabel(wo.status)}」移到「${getStatusLabel(targetStatus)}」`);
      return;
    }

    const action = getDragAction(wo.status, targetStatus);
    if (!action) {
      const hint = getDragHint(wo.status, targetStatus);
      showToast(hint);
      return;
    }

    // Special case: assigning contractor needs a modal
    if (action === "pm_assign_contractor") {
      onAssignContractor(wo.id);
      return;
    }

    // Non-PM actions require confirmation
    const confirmMessages: Record<string, string> = {
      contractor_start_quote: "确认代替工人开始报价？",
      contractor_submit_completion: "确认代替工人提交完工？",
      tenant_confirm: "确认代替租户验收完成？",
    };

    const confirmMsg = confirmMessages[action];
    if (confirmMsg) {
      setConfirmDialog({
        message: confirmMsg,
        onConfirm: async () => {
          setConfirmDialog(null);
          const success = await onTransition(wo.id, action);
          if (!success) {
            showToast("操作失败，请重试");
          }
        },
      });
      return;
    }

    const success = await onTransition(wo.id, action);
    if (!success) {
      showToast("操作失败，请重试");
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setDragOverColumn(null);
      return;
    }
    const targetStatus = resolveTargetStatus(over.id);
    setDragOverColumn(targetStatus);
  };

  // Group work orders by status
  const grouped = KANBAN_COLUMNS.reduce(
    (acc, status) => {
      acc[status] = workOrders.filter((wo) => wo.status === status);
      return acc;
    },
    {} as Record<WorkOrderStatus, KanbanWorkOrder[]>
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex gap-4 h-full overflow-x-auto p-4 bg-[#F8F9FA]" onClick={onBackgroundClick}>
        {KANBAN_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            workOrders={grouped[status]}
            onCardClick={onCardClick}
            dropValidity={dragOverColumn === status ? getDropValidity(status) : (activeCard ? (activeCard.status === status ? "same" : getDropValidity(status)) : null)}
            isDragTarget={dragOverColumn === status}
          />
        ))}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeCard && (
          <div className="w-[260px] opacity-90 rotate-2">
            <KanbanCard workOrder={activeCard} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>

      {/* Confirm dialog for non-PM actions */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setConfirmDialog(null)} />
          <div className="relative bg-white rounded-lg shadow-xl px-6 py-5 max-w-sm w-full mx-4">
            <p className="text-sm text-gray-700 mb-4">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-3 h-8 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-3 h-8 text-sm text-white bg-brand-600 rounded-md hover:bg-brand-700"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-[#E5E7EB] shadow-md rounded-lg px-4 py-3 text-sm text-gray-700 animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}
    </DndContext>
  );
}
