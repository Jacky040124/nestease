"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { MobileLayout } from "@/components/mobile-layout";

interface VerifyData {
  id: string;
  property_address: string;
  unit: string | null;
  description: string;
  tenant_id: string;
  completion_report: {
    work_description: string;
    completion_photos: string[];
    submitted_at: string;
  } | null;
}

function VerifyPage() {
  const searchParams = useSearchParams();
  const workOrderId = searchParams.get("id") ?? "";
  const token = searchParams.get("token") ?? "";

  const [data, setData] = useState<VerifyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<"confirmed" | "issue" | null>(null);
  const [issueDescription, setIssueDescription] = useState("");
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workOrderId) return;
    fetch(`/api/public/work-orders/${workOrderId}?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((json) => { if (json.data) setData(json.data); })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [workOrderId]);

  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/public/work-orders/${workOrderId}/transition?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "tenant_confirm",
          actor_id: data?.tenant_id,
          actor_role: "tenant",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult("confirmed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportIssue = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/public/work-orders/${workOrderId}/transition?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "tenant_report_issue",
          actor_id: data?.tenant_id,
          actor_role: "tenant",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult("issue");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <MobileLayout title="维修完成确认">
        <div className="text-center text-sm text-gray-400 py-8">加载中...</div>
      </MobileLayout>
    );
  }

  if (result === "confirmed") {
    return (
      <MobileLayout title="确认完成">
        <div className="text-center space-y-4">
          <div className="text-3xl">🎉</div>
          <h2 className="text-md font-semibold text-gray-900">感谢您的确认!</h2>
          <p className="text-sm text-gray-500">如有其他问题欢迎随时报修。</p>
        </div>
      </MobileLayout>
    );
  }

  if (result === "issue") {
    return (
      <MobileLayout title="已反馈问题">
        <div className="text-center space-y-4">
          <div className="text-3xl">📋</div>
          <h2 className="text-md font-semibold text-gray-900">已收到您的反馈</h2>
          <p className="text-sm text-gray-500">我们已创建新的工单，会尽快安排处理。</p>
        </div>
      </MobileLayout>
    );
  }

  if (!data) {
    return (
      <MobileLayout title="维修完成确认">
        <div className="text-center text-sm text-error py-8">{error || "工单不存在"}</div>
      </MobileLayout>
    );
  }

  const address = data.unit ? `${data.property_address}, ${data.unit}` : data.property_address;

  return (
    <MobileLayout title="维修完成确认">
      <div className="space-y-4">
        {/* Work order info */}
        <div>
          <div className="text-xs text-gray-400 font-mono">WO-{data.id.slice(0, 8)}</div>
          <div className="text-sm font-medium text-gray-900 mt-0.5">{address}</div>
          <div className="text-sm text-gray-600 mt-0.5">{data.description}</div>
        </div>

        {/* Completion report */}
        {data.completion_report && (
          <div className="border-t border-[#F3F4F6] pt-3">
            <div className="text-sm text-gray-700">
              <span className="text-gray-500">维修内容：</span>
              {data.completion_report.work_description}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              完工时间：{new Date(data.completion_report.submitted_at).toLocaleDateString("zh-CN")}
            </div>
            {data.completion_report.completion_photos.length > 0 && (
              <div className="flex gap-2 mt-2 overflow-x-auto">
                {data.completion_report.completion_photos.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-20 h-20 object-cover rounded-md border border-[#E5E7EB]" />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-[#E5E7EB] pt-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">问题是否已解决?</h3>

          <button
            onClick={handleConfirm}
            disabled={actionLoading}
            className="w-full h-10 bg-brand-600 text-white text-sm font-medium rounded-md
                       hover:bg-brand-700 disabled:opacity-50 mb-2"
          >
            ✅ 已解决，确认完工
          </button>

          {!showIssueForm ? (
            <button
              onClick={() => setShowIssueForm(true)}
              className="w-full h-10 border border-[#E5E7EB] text-gray-600 text-sm font-medium rounded-md
                         hover:bg-[#F1F3F5]"
            >
              ❌ 未解决，仍有问题
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md text-sm resize-none
                           focus:outline-none focus:border-brand-600 placeholder:text-gray-400"
                placeholder="请描述仍存在的问题"
              />
              <button
                onClick={handleReportIssue}
                disabled={actionLoading}
                className="w-full h-10 border border-[#DC2626] text-[#DC2626] text-sm font-medium rounded-md
                           hover:bg-[#FEF2F2] disabled:opacity-50"
              >
                {actionLoading ? "提交中..." : "提交问题反馈"}
              </button>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center mt-3">
            如 10 天内未确认，将自动视为已解决。
          </p>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}
      </div>
    </MobileLayout>
  );
}

export default function VerifyPageWrapper() {
  return (
    <Suspense>
      <VerifyPage />
    </Suspense>
  );
}
