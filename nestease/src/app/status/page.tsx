"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MobileLayout } from "@/components/mobile-layout";
import { WorkOrderStatus } from "@/types";
import { TENANT_ACTION_LABELS } from "@/lib/labels";

interface StatusData {
  id: string;
  status: WorkOrderStatus;
  property_address: string;
  unit: string | null;
  description: string;
  contractor_id: string | null;
  created_at: string;
  quote: { total: number; estimated_completion: string | null } | null;
  status_history: { action: string; created_at: string }[];
}

const PROGRESS_STEPS = [
  { status: WorkOrderStatus.PendingAssignment, label: "已提交" },
  { status: WorkOrderStatus.Assigned, label: "已派单" },
  { status: WorkOrderStatus.Quoting, label: "已报价" },
  { status: WorkOrderStatus.InProgress, label: "施工中" },
  { status: WorkOrderStatus.PendingVerification, label: "待验收" },
  { status: WorkOrderStatus.Completed, label: "已完成" },
];

const ACTION_LABELS = TENANT_ACTION_LABELS;

function getStepIndex(status: WorkOrderStatus): number {
  const idx = PROGRESS_STEPS.findIndex((s) => s.status === status);
  // For PendingApproval, show as between Quoting and InProgress
  if (status === WorkOrderStatus.PendingApproval) return 2;
  return idx >= 0 ? idx : 0;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const token = searchParams.get("token") ?? "";
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/public/work-orders/${id}?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <MobileLayout title="工单状态跟踪">
        <div className="text-center text-sm text-gray-400 py-8">加载中...</div>
      </MobileLayout>
    );
  }

  if (error || !data) {
    return (
      <MobileLayout title="工单状态跟踪">
        <div className="text-center text-sm text-error py-8">{error || "工单不存在"}</div>
      </MobileLayout>
    );
  }

  const currentStep = getStepIndex(data.status);
  const address = data.unit ? `${data.property_address}, ${data.unit}` : data.property_address;

  return (
    <MobileLayout title="工单状态跟踪">
      <div className="space-y-4">
        {/* Work order info */}
        <div>
          <div className="text-xs text-gray-400 font-mono">WO-{data.id.slice(0, 8)}</div>
          <div className="text-md font-semibold text-gray-900 mt-0.5">{address}</div>
          <div className="text-sm text-gray-600 mt-0.5">{data.description}</div>
        </div>

        {/* Cancelled/OnHold state */}
        {data.status === WorkOrderStatus.Cancelled && (
          <div className="text-center py-4 text-sm text-gray-400">该工单已取消</div>
        )}

        {data.status === WorkOrderStatus.OnHold && (
          <div className="text-center py-4 text-sm text-warning">工单暂时挂起，请等待通知</div>
        )}

        {/* Progress steps */}
        {data.status !== WorkOrderStatus.Cancelled && data.status !== WorkOrderStatus.OnHold && (
          <div className="space-y-0">
            {PROGRESS_STEPS.map((step, i) => {
              const isDone = i <= currentStep;
              const isCurrent = i === currentStep;
              return (
                <div key={step.status} className="flex items-start gap-3">
                  {/* Dot + line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
                        isDone
                          ? isCurrent
                            ? "bg-brand-600 text-white"
                            : "bg-brand-100 text-brand-600"
                          : "bg-[#E5E7EB] text-gray-400"
                      }`}
                    >
                      {isDone && !isCurrent ? "✓" : isCurrent ? "●" : "○"}
                    </div>
                    {i < PROGRESS_STEPS.length - 1 && (
                      <div className={`w-px h-6 ${isDone ? "bg-brand-200" : "bg-[#E5E7EB]"}`} />
                    )}
                  </div>
                  {/* Label */}
                  <div className={`text-sm pb-4 ${isCurrent ? "font-semibold text-gray-900" : isDone ? "text-gray-600" : "text-gray-400"}`}>
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Estimated completion */}
        {data.quote?.estimated_completion && (
          <div className="text-sm text-gray-500">
            预计完工：{new Date(data.quote.estimated_completion).toLocaleDateString("zh-CN")}
          </div>
        )}

        {/* Recent activity */}
        <div className="border-t border-[#F3F4F6] pt-3">
          <h3 className="text-xs font-medium text-gray-400 mb-2">最新动态</h3>
          <div className="space-y-2">
            {[...data.status_history].reverse().map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-gray-400 font-mono shrink-0">{formatDate(h.created_at)}</span>
                <span className="text-gray-600">{ACTION_LABELS[h.action] ?? h.action}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Verification link for pending_verification */}
        {data.status === WorkOrderStatus.PendingVerification && (
          <a
            href={`/verify?id=${data.id}`}
            className="block w-full h-10 leading-10 text-center bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700"
          >
            确认维修结果
          </a>
        )}
      </div>
    </MobileLayout>
  );
}

export default function StatusPageWrapper() {
  return (
    <Suspense>
      <StatusPage />
    </Suspense>
  );
}
