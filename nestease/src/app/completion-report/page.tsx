"use client";

import { Suspense, useState, FormEvent, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { MobileLayout } from "@/components/mobile-layout";
import { WorkType } from "@/types";

interface MaterialRow {
  name: string;
  quantity: number;
  unit_price: number;
}

const WORK_TYPE_OPTIONS = [
  { value: WorkType.Replacement, label: "更换零件" },
  { value: WorkType.Repair, label: "修复" },
  { value: WorkType.Cleaning, label: "清洁" },
  { value: WorkType.Other, label: "其他" },
];

function CompletionReportPage() {
  const searchParams = useSearchParams();
  const workOrderId = searchParams.get("id") ?? "";
  const contractorId = searchParams.get("contractor_id") ?? "";
  const token = searchParams.get("token") ?? "";

  const [woInfo, setWoInfo] = useState<{ property_address: string; description: string; quote?: { total: number } } | null>(null);
  const [workType, setWorkType] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [laborHours, setLaborHours] = useState("");
  const [laborRate, setLaborRate] = useState("");
  const [otherCost, setOtherCost] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workOrderId) return;
    fetch(`/api/public/work-orders/${workOrderId}?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((json) => { if (json.data) setWoInfo(json.data); });
  }, [workOrderId]);

  const addMaterial = () => setMaterials([...materials, { name: "", quantity: 1, unit_price: 0 }]);
  const updateMaterial = (i: number, field: keyof MaterialRow, value: string | number) => {
    const updated = [...materials];
    updated[i] = { ...updated[i], [field]: value };
    setMaterials(updated);
  };
  const removeMaterial = (i: number) => setMaterials(materials.filter((_, idx) => idx !== i));

  const materialsCost = materials.reduce((s, m) => s + m.quantity * m.unit_price, 0);
  const laborCost = (parseFloat(laborHours) || 0) * (parseFloat(laborRate) || 0);
  const actualTotal = materialsCost + laborCost + (parseFloat(otherCost) || 0);
  const originalQuote = woInfo?.quote?.total;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/public/work-orders/${workOrderId}/completion-report?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractor_id: contractorId,
          work_type: workType,
          work_description: workDescription,
          actual_materials: materials,
          actual_labor_hours: parseFloat(laborHours) || 0,
          actual_labor_rate: parseFloat(laborRate) || 0,
          actual_other_cost: parseFloat(otherCost) || 0,
          completion_photos: [],
          recommendations: recommendations || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <MobileLayout title="完工报告已提交">
        <div className="text-center space-y-4">
          <div className="text-3xl">✅</div>
          <h2 className="text-md font-semibold text-gray-900">完工报告已提交!</h2>
          <p className="text-sm text-gray-500">租户将收到确认通知。</p>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="完工报告提交">
      {woInfo && (
        <div className="mb-4 pb-4 border-b border-[#F3F4F6]">
          <h3 className="text-xs font-medium text-gray-400 mb-1">工单信息</h3>
          <div className="text-sm font-medium text-gray-900">{woInfo.property_address}</div>
          <div className="text-sm text-gray-600 mt-0.5">{woInfo.description}</div>
          {originalQuote != null && (
            <div className="text-xs text-gray-500 mt-1">原报价：<span className="font-mono">${originalQuote}</span></div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Work type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">维修类型 *</label>
          <div className="flex flex-wrap gap-2">
            {WORK_TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm cursor-pointer transition-colors ${
                  workType === opt.value
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-[#E5E7EB] text-gray-600 hover:bg-[#F1F3F5]"
                }`}
              >
                <input
                  type="radio"
                  name="workType"
                  value={opt.value}
                  checked={workType === opt.value}
                  onChange={() => setWorkType(opt.value)}
                  className="sr-only"
                  required
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Work description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">维修内容描述 *</label>
          <textarea
            value={workDescription}
            onChange={(e) => setWorkDescription(e.target.value)}
            required
            rows={3}
            className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md text-sm resize-none
                       focus:outline-none focus:border-brand-600 placeholder:text-gray-400"
            placeholder="描述维修内容"
          />
        </div>

        {/* Actual materials */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">实际材料费</label>
          {materials.map((m, i) => (
            <div key={i} className="flex gap-2 mb-2 items-center">
              <input type="text" value={m.name} onChange={(e) => updateMaterial(i, "name", e.target.value)}
                placeholder="名称" className="flex-1 h-9 px-2 border border-[#E5E7EB] rounded-md text-sm focus:outline-none focus:border-brand-600" />
              <input type="number" value={m.quantity} onChange={(e) => updateMaterial(i, "quantity", parseInt(e.target.value) || 0)}
                className="w-16 h-9 px-2 border border-[#E5E7EB] rounded-md text-sm text-center font-mono focus:outline-none focus:border-brand-600" min={1} />
              <input type="number" value={m.unit_price || ""} onChange={(e) => updateMaterial(i, "unit_price", parseFloat(e.target.value) || 0)}
                placeholder="$单价" className="w-20 h-9 px-2 border border-[#E5E7EB] rounded-md text-sm font-mono focus:outline-none focus:border-brand-600" min={0} step="0.01" />
              <button type="button" onClick={() => removeMaterial(i)} className="text-gray-400 hover:text-error text-sm">✕</button>
            </div>
          ))}
          <button type="button" onClick={addMaterial} className="text-sm text-brand-600 hover:text-brand-700">+ 添加材料</button>
        </div>

        {/* Actual labor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">实际人工费</label>
          <div className="flex gap-2">
            <input type="number" value={laborHours} onChange={(e) => setLaborHours(e.target.value)}
              placeholder="实际工时(h)" className="flex-1 h-9 px-3 border border-[#E5E7EB] rounded-md text-sm font-mono focus:outline-none focus:border-brand-600" min={0} step="0.5" />
            <input type="number" value={laborRate} onChange={(e) => setLaborRate(e.target.value)}
              placeholder="$/h" className="flex-1 h-9 px-3 border border-[#E5E7EB] rounded-md text-sm font-mono focus:outline-none focus:border-brand-600" min={0} step="0.01" />
          </div>
        </div>

        {/* Other cost */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">其他费用</label>
          <input type="number" value={otherCost} onChange={(e) => setOtherCost(e.target.value)}
            placeholder="$0" className="w-full h-9 px-3 border border-[#E5E7EB] rounded-md text-sm font-mono focus:outline-none focus:border-brand-600" min={0} step="0.01" />
        </div>

        {/* Total comparison */}
        <div className="border-t border-[#E5E7EB] pt-3 space-y-1">
          <div className="flex justify-between text-md font-semibold">
            <span className="text-gray-700">实际总计</span>
            <span className="font-mono text-gray-900">${actualTotal.toFixed(2)}</span>
          </div>
          {originalQuote != null && (
            <>
              <div className="flex justify-between text-sm text-gray-500">
                <span>原报价</span>
                <span className="font-mono">${originalQuote}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">差额</span>
                <span className={`font-mono ${actualTotal > originalQuote ? "text-error" : actualTotal < originalQuote ? "text-success" : "text-gray-500"}`}>
                  {actualTotal >= originalQuote ? "+" : ""}{(actualTotal - originalQuote).toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Recommendations */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">后续维护建议</label>
          <textarea
            value={recommendations}
            onChange={(e) => setRecommendations(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md text-sm resize-none
                       focus:outline-none focus:border-brand-600 placeholder:text-gray-400"
            placeholder="选填"
          />
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full h-10 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? "提交中..." : "提交完工报告"}
        </button>
      </form>
    </MobileLayout>
  );
}

export default function CompletionReportPageWrapper() {
  return (
    <Suspense>
      <CompletionReportPage />
    </Suspense>
  );
}
