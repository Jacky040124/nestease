"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { StatusBadge } from "./status-badge";
import { UrgencyBadge } from "./urgency-badge";
import { WorkOrderStatus, Urgency } from "@/types";
import { ACTION_LABELS, CATEGORY_LABELS } from "@/lib/labels";

interface WorkOrderFull {
  id: string;
  status: WorkOrderStatus;
  property_address: string;
  unit: string | null;
  description: string;
  category: string;
  urgency: Urgency;
  tenant_name: string;
  tenant_phone: string;
  contractor_id: string | null;
  assigned_at: string | null;
  approval_status: string | null;
  approved_by: string | null;
  approved_at: string | null;
  completed_at: string | null;
  photos: string[];
  created_at: string;
  quote: {
    total: number;
    labor_cost: number;
    materials_cost: number;
    other_cost: number;
    submitted_at: string;
  } | null;
  completion_report: {
    work_type: string;
    work_description: string;
    actual_total: number;
    completion_photos: string[];
    submitted_at: string;
  } | null;
  status_history: {
    from_status: string | null;
    to_status: string;
    action: string;
    actor_role: string | null;
    created_at: string;
  }[];
}


function formatDateTime(date: string): string {
  return new Date(date).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WorkOrderDetail({
  workOrderId,
  pmId,
  onClose,
  onRefresh,
  onAssignContractor,
}: {
  workOrderId: string;
  pmId: string;
  onClose: () => void;
  onRefresh: () => void;
  onAssignContractor?: (workOrderId: string) => void;
}) {
  const router = useRouter();
  const [wo, setWo] = useState<WorkOrderFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setAgentSessionId(null);
    api.getWorkOrder(workOrderId).then((res) => {
      const data = res.data as WorkOrderFull;
      setWo(data);
      setLoading(false);

      if (data.contractor_id) {
        api.getAgentSessionByContractor(data.contractor_id, pmId)
          .then((res) => {
            const sessions = res.data as Array<{ session_id: string }>;
            if (sessions.length > 0) setAgentSessionId(sessions[0].session_id);
          })
          .catch(() => {});
      }
    }).catch(() => setLoading(false));
  }, [workOrderId, pmId]);

  const handleAction = async (action: string, extra?: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      await api.transition(workOrderId, {
        action,
        actor_id: pmId,
        actor_role: "pm",
        ...extra,
      });
      onRefresh();
      // Re-fetch detail
      const res = await api.getWorkOrder(workOrderId);
      setWo(res.data as WorkOrderFull);
    } catch {
      // handle error
    } finally {
      setActionLoading(false);
    }
  };

  const handleRatingSubmit = async () => {
    if (!wo || !wo.contractor_id || ratingValue < 1) return;
    setRatingLoading(true);
    try {
      await api.rateContractor(wo.contractor_id, {
        work_order_id: wo.id,
        rating: ratingValue,
        comment: ratingComment.trim() || null,
      });
      setRatingSubmitted(true);
    } catch {
      // silently fail
    } finally {
      setRatingLoading(false);
    }
  };

  return (
    <div
      className="w-[480px] min-w-[480px] border-l border-[#E5E7EB] bg-white h-full flex flex-col overflow-hidden shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-[#E5E7EB] shrink-0">
        <span className="text-sm font-mono text-gray-400">
          WO-{workOrderId.slice(0, 8)}
        </span>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#F1F3F5] text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading || !wo ? (
          <div className="flex items-center justify-center h-40">
            <span className="text-sm text-gray-400">加载中...</span>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Status */}
            <div className="flex items-center gap-2">
              <StatusBadge status={wo.status} />
              <UrgencyBadge urgency={wo.urgency} />
            </div>

            {/* Address + description */}
            <div>
              <h2 className="text-md font-semibold text-gray-900">
                {wo.unit ? `${wo.property_address}, ${wo.unit}` : wo.property_address}
              </h2>
              <p className="text-sm text-gray-600 mt-1">{wo.description}</p>
            </div>

            {/* Photos */}
            {wo.photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {wo.photos.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`报修照片 ${i + 1}`}
                    className="w-20 h-20 object-cover rounded-md border border-[#E5E7EB]"
                  />
                ))}
              </div>
            )}

            {/* Basic info */}
            <section className="border-t border-[#F3F4F6] pt-3">
              <h3 className="text-xs font-medium text-gray-400 mb-2">基本信息</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">租户</span>
                  <span className="text-gray-900">{wo.tenant_name} {wo.tenant_phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">类别</span>
                  <span className="text-gray-900">{CATEGORY_LABELS[wo.category] ?? wo.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">创建</span>
                  <span className="text-gray-900">{formatDateTime(wo.created_at)}</span>
                </div>
              </div>
            </section>

            {/* Quote info */}
            {wo.quote && (
              <section className="border-t border-[#F3F4F6] pt-3">
                <h3 className="text-xs font-medium text-gray-400 mb-2">报价</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">材料费</span>
                    <span className="font-mono text-gray-900">${wo.quote.materials_cost}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">人工费</span>
                    <span className="font-mono text-gray-900">${wo.quote.labor_cost}</span>
                  </div>
                  {wo.quote.other_cost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">其他</span>
                      <span className="font-mono text-gray-900">${wo.quote.other_cost}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t border-[#F3F4F6] pt-1.5">
                    <span className="text-gray-700">总计</span>
                    <span className="font-mono text-gray-900">${wo.quote.total}</span>
                  </div>
                </div>
              </section>
            )}

            {/* Completion report */}
            {wo.completion_report && (
              <section className="border-t border-[#F3F4F6] pt-3">
                <h3 className="text-xs font-medium text-gray-400 mb-2">完工报告</h3>
                <p className="text-sm text-gray-700">{wo.completion_report.work_description}</p>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-500">实际费用</span>
                  <span className="font-mono text-gray-900">${wo.completion_report.actual_total}</span>
                </div>
                {wo.completion_report.completion_photos.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {wo.completion_report.completion_photos.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`完工照片 ${i + 1}`}
                        className="w-20 h-20 object-cover rounded-md border border-[#E5E7EB]"
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Rating section — completed orders with a contractor */}
            {wo.status === WorkOrderStatus.Completed && wo.contractor_id && (
              <section className="border-t border-[#F3F4F6] pt-3">
                <h3 className="text-xs font-medium text-gray-400 mb-2">给师傅评分</h3>
                {ratingSubmitted ? (
                  <div className="text-sm text-green-600">
                    已评分 {"★".repeat(ratingValue)}
                    {ratingComment && (
                      <p className="text-xs text-gray-500 mt-1">{ratingComment}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Star selector */}
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRatingValue(star)}
                          onMouseEnter={() => setRatingHover(star)}
                          onMouseLeave={() => setRatingHover(0)}
                          className="text-xl leading-none transition-colors"
                        >
                          <span
                            className={
                              star <= (ratingHover || ratingValue)
                                ? "text-amber-400"
                                : "text-gray-300"
                            }
                          >
                            ★
                          </span>
                        </button>
                      ))}
                    </div>
                    {/* Comment */}
                    <input
                      type="text"
                      placeholder="备注（可选）"
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      className="w-full h-8 px-3 text-xs border border-[#E5E7EB] rounded-md focus:outline-none focus:border-brand-600"
                    />
                    <button
                      onClick={handleRatingSubmit}
                      disabled={ratingLoading || ratingValue < 1}
                      className="h-8 px-4 text-xs font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 disabled:opacity-50"
                    >
                      {ratingLoading ? "提交中..." : "提交评分"}
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Timeline */}
            <section className="border-t border-[#F3F4F6] pt-3">
              <h3 className="text-xs font-medium text-gray-400 mb-2">操作时间线</h3>
              <div className="space-y-2">
                {wo.status_history.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-gray-400 font-mono shrink-0 w-24">
                      {formatDateTime(h.created_at)}
                    </span>
                    <span className="text-gray-600">
                      {ACTION_LABELS[h.action] ?? h.action}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Agent session link */}
            {agentSessionId && (
              <section className="border-t border-[#F3F4F6] pt-3">
                <button
                  onClick={() => router.push(`/dashboard/agent/session/${agentSessionId}`)}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  查看龙虾对话
                </button>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {wo && (
        <div className="shrink-0 border-t border-[#E5E7EB] p-3 flex gap-2">
          {/* Hold button — available for all active statuses */}
          {![WorkOrderStatus.Completed, WorkOrderStatus.Cancelled, WorkOrderStatus.OnHold].includes(wo.status) && (
            <button
              onClick={() => handleAction("pm_hold")}
              disabled={actionLoading}
              className="px-3 h-8 text-sm border border-[#E5E7EB] rounded-md text-gray-600 hover:bg-[#F1F3F5] disabled:opacity-50"
            >
              挂起
            </button>
          )}

          {/* Resume from hold */}
          {wo.status === WorkOrderStatus.OnHold && (
            <button
              onClick={() => handleAction("pm_resume")}
              disabled={actionLoading}
              className="px-3 h-8 text-sm bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:opacity-50"
            >
              恢复
            </button>
          )}

          {/* Cancel — available for all active statuses */}
          {![WorkOrderStatus.Completed, WorkOrderStatus.Cancelled, WorkOrderStatus.OnHold].includes(wo.status) && (
            <button
              onClick={() => handleAction("pm_cancel")}
              disabled={actionLoading}
              className="px-3 h-8 text-sm border border-[#E5E7EB] rounded-md text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-50"
            >
              取消工单
            </button>
          )}

          {/* Assign contractor for pending_assignment */}
          {wo.status === WorkOrderStatus.PendingAssignment && onAssignContractor && (
            <button
              onClick={() => onAssignContractor(wo.id)}
              className="ml-auto px-3 h-8 text-sm bg-brand-600 text-white rounded-md hover:bg-brand-700"
            >
              指派 Contractor
            </button>
          )}

          {/* Pending approval actions */}
          {wo.status === WorkOrderStatus.PendingApproval && (
            <>
              <button
                onClick={async () => {
                  setActionLoading(true);
                  try {
                    const res = await api.sendApprovalRequest(wo.id);
                    window.open(res.pdf_url, "_blank");
                  } catch {
                    alert("生成失败，请重试");
                  } finally {
                    setActionLoading(false);
                  }
                }}
                disabled={actionLoading}
                className="ml-auto px-3 h-8 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:opacity-50"
              >
                下载审批PDF
              </button>
              <button
                onClick={() => handleAction("owner_approve")}
                disabled={actionLoading}
                className="px-3 h-8 text-sm bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:opacity-50"
              >
                批准工单
              </button>
            </>
          )}

          {/* Manual close for pending_verification */}
          {wo.status === WorkOrderStatus.PendingVerification && (
            <button
              onClick={() => handleAction("pm_manual_close")}
              disabled={actionLoading}
              className="ml-auto px-3 h-8 text-sm bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:opacity-50"
            >
              手动标记完成
            </button>
          )}

          {/* Download archive PDF for completed */}
          {wo.status === WorkOrderStatus.Completed && (
            <button
              onClick={async () => {
                setActionLoading(true);
                try {
                  const res = await api.sendArchiveReport(wo.id);
                  window.open(res.pdf_url, "_blank");
                } catch {
                  alert("生成失败，请重试");
                } finally {
                  setActionLoading(false);
                }
              }}
              disabled={actionLoading}
              className="ml-auto px-3 h-8 text-sm bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:opacity-50"
            >
              下载归档报告
            </button>
          )}
        </div>
      )}
    </div>
  );
}
