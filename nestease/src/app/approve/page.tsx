"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { MobileLayout } from "@/components/mobile-layout";
import { CATEGORY_LABELS } from "@/lib/labels";

interface ApprovalData {
  id: string;
  property_address: string;
  unit: string | null;
  description: string;
  category: string;
  photos: string[];
  created_at: string;
  quote: {
    total: number;
    labor_cost: number;
    materials_cost: number;
    materials: { name: string; quantity: number; unit_price: number; subtotal: number }[];
    other_cost: number;
    estimated_completion: string | null;
    labor_hours: number;
    labor_rate: number;
  } | null;
}


function ApprovePage() {
  const searchParams = useSearchParams();
  const workOrderId = searchParams.get("id") ?? "";
  const ownerId = searchParams.get("owner_id") ?? "";
  const token = searchParams.get("token") ?? "";

  const [data, setData] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [result, setResult] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workOrderId) return;
    fetch(`/api/public/work-orders/${workOrderId}?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((json) => { if (json.data) setData(json.data); })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [workOrderId]);

  const handleAction = async (action: "owner_approve" | "owner_reject") => {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/public/work-orders/${workOrderId}/transition?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          actor_id: ownerId,
          actor_role: "owner",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult(action === "owner_approve" ? "approved" : "rejected");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <MobileLayout title="维修报价审批">
        <div className="text-center text-sm text-gray-400 py-8">加载中...</div>
      </MobileLayout>
    );
  }

  if (result) {
    return (
      <MobileLayout title="审批完成">
        <div className="text-center space-y-4">
          <div className="text-3xl">{result === "approved" ? "✅" : "❌"}</div>
          <h2 className="text-md font-semibold text-gray-900">
            {result === "approved" ? "报价已批准" : "报价已拒绝"}
          </h2>
          <p className="text-sm text-gray-500">
            {result === "approved"
              ? "维修师傅将尽快安排施工。"
              : "PM 将重新安排方案。"}
          </p>
        </div>
      </MobileLayout>
    );
  }

  if (!data || !data.quote) {
    return (
      <MobileLayout title="维修报价审批">
        <div className="text-center text-sm text-error py-8">{error || "数据不存在"}</div>
      </MobileLayout>
    );
  }

  const address = data.unit ? `${data.property_address}, ${data.unit}` : data.property_address;

  return (
    <MobileLayout title="维修报价审批">
      <div className="space-y-4">
        {/* Quick Review */}
        <div className="bg-[#F8F9FA] rounded-lg p-4 space-y-2">
          <div className="text-sm">
            <span className="text-gray-500">物业：</span>
            <span className="text-gray-900 font-medium">{address}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">问题：</span>
            <span className="text-gray-900">{data.description}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">报价：</span>
            <span className="text-gray-900 font-mono font-semibold">${data.quote.total}</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => handleAction("owner_approve")}
              disabled={actionLoading}
              className="flex-1 h-10 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700 disabled:opacity-50"
            >
              {actionLoading ? "处理中..." : "批准"}
            </button>
            <button
              onClick={() => handleAction("owner_reject")}
              disabled={actionLoading}
              className="flex-1 h-10 border border-[#E5E7EB] text-[#DC2626] text-sm font-medium rounded-md hover:bg-[#FEF2F2] disabled:opacity-50"
            >
              拒绝
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        {/* Toggle detail */}
        <button
          onClick={() => setShowDetail(!showDetail)}
          className="text-sm text-brand-600 hover:text-brand-700"
        >
          {showDetail ? "▲ 收起详细信息" : "▼ 查看详细信息"}
        </button>

        {/* Detail section */}
        {showDetail && (
          <div className="space-y-3 text-sm">
            {/* Photos */}
            {data.photos.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-400 mb-1">报修照片</h3>
                <div className="flex gap-2 overflow-x-auto">
                  {data.photos.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-20 h-20 object-cover rounded-md border border-[#E5E7EB]" />
                  ))}
                </div>
              </div>
            )}

            {/* Quote breakdown */}
            <div>
              <h3 className="text-xs font-medium text-gray-400 mb-1">报价明细</h3>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">材料费</span>
                  <span className="font-mono">${data.quote.materials_cost}</span>
                </div>
                {data.quote.materials?.map((m, i) => (
                  <div key={i} className="flex justify-between pl-3 text-xs text-gray-400">
                    <span>{m.name} x{m.quantity}</span>
                    <span className="font-mono">${m.subtotal}</span>
                  </div>
                ))}
                <div className="flex justify-between">
                  <span className="text-gray-500">人工费（{data.quote.labor_hours}h x ${data.quote.labor_rate}/h）</span>
                  <span className="font-mono">${data.quote.labor_cost}</span>
                </div>
                {data.quote.other_cost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">其他</span>
                    <span className="font-mono">${data.quote.other_cost}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t border-[#F3F4F6] pt-1">
                  <span>总计</span>
                  <span className="font-mono">${data.quote.total}</span>
                </div>
              </div>
            </div>

            {data.quote.estimated_completion && (
              <div className="flex justify-between">
                <span className="text-gray-500">预估完工</span>
                <span>{new Date(data.quote.estimated_completion).toLocaleDateString("zh-CN")}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}

export default function ApprovePageWrapper() {
  return (
    <Suspense>
      <ApprovePage />
    </Suspense>
  );
}
