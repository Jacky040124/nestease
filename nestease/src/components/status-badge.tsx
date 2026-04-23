import { WorkOrderStatus } from "@/types";

const STATUS_CONFIG: Record<WorkOrderStatus, { label: string; dot: string; bg: string; text: string }> = {
  [WorkOrderStatus.PendingAssignment]: { label: "待分配", dot: "bg-[#6B7280]", bg: "bg-[#F3F4F6]", text: "text-[#374151]" },
  [WorkOrderStatus.Assigned]:         { label: "已派单", dot: "bg-[#2563EB]", bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]" },
  [WorkOrderStatus.Quoting]:          { label: "报价中", dot: "bg-[#7C3AED]", bg: "bg-[#F5F3FF]", text: "text-[#6D28D9]" },
  [WorkOrderStatus.PendingApproval]:  { label: "待审批", dot: "bg-[#F59E0B]", bg: "bg-[#FFFBEB]", text: "text-[#B45309]" },
  [WorkOrderStatus.InProgress]:       { label: "施工中", dot: "bg-[#0D9488]", bg: "bg-[#F0FDFA]", text: "text-[#0F766E]" },
  [WorkOrderStatus.PendingVerification]: { label: "待验收", dot: "bg-[#EA580C]", bg: "bg-[#FFF7ED]", text: "text-[#C2410C]" },
  [WorkOrderStatus.Completed]:        { label: "已完成", dot: "bg-[#16A34A]", bg: "bg-[#F0FDF4]", text: "text-[#15803D]" },
  [WorkOrderStatus.Cancelled]:        { label: "已取消", dot: "bg-[#9CA3AF]", bg: "bg-[#F9FAFB]", text: "text-[#6B7280]" },
  [WorkOrderStatus.OnHold]:           { label: "挂起",   dot: "bg-[#DC2626]", bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]" },
};

export function StatusBadge({ status }: { status: WorkOrderStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

export function getStatusLabel(status: WorkOrderStatus): string {
  return STATUS_CONFIG[status]?.label ?? status;
}

export function getStatusConfig(status: WorkOrderStatus) {
  return STATUS_CONFIG[status];
}
