"use client";

import { Suspense, useState, FormEvent, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { MobileLayout } from "@/components/mobile-layout";

interface MaterialRow {
  name: string;
  quantity: number;
  unit_price: number;
}

interface WorkOrderInfo {
  property_address: string;
  unit: string | null;
  description: string;
  urgency: string;
  photos: string[];
  status: string;
  tenant_name: string | null;
  tenant_phone: string | null;
  category: string;
  created_at: string;
}

function QuotePage() {
  const searchParams = useSearchParams();
  const workOrderId = searchParams.get("id") ?? "";
  const contractorId = searchParams.get("contractor_id") ?? "";
  const token = searchParams.get("token") ?? "";

  const [woInfo, setWoInfo] = useState<WorkOrderInfo | null>(null);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [laborHours, setLaborHours] = useState("");
  const [laborRate, setLaborRate] = useState("");
  const [otherCost, setOtherCost] = useState("");
  const [otherDescription, setOtherDescription] = useState("");
  const [estimatedCompletion, setEstimatedCompletion] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [autoApproved, setAutoApproved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workOrderId) return;
    fetch(`/api/public/work-orders/${workOrderId}?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setWoInfo(json.data);
          // If already in quoting or later, skip the accept step
          if (json.data.status !== "assigned") setAccepted(true);
        }
      });
  }, [workOrderId]);

  const handleAccept = async () => {
    setAccepting(true);
    setError("");
    try {
      const res = await fetch(`/api/public/work-orders/${workOrderId}/transition?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "contractor_start_quote" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setAccepting(false);
    }
  };

  const addMaterial = () => {
    setMaterials([...materials, { name: "", quantity: 1, unit_price: 0 }]);
  };

  const updateMaterial = (index: number, field: keyof MaterialRow, value: string | number) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    setMaterials(updated);
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const materialsCost = materials.reduce((sum, m) => sum + m.quantity * m.unit_price, 0);
  const laborCost = (parseFloat(laborHours) || 0) * (parseFloat(laborRate) || 0);
  const total = materialsCost + laborCost + (parseFloat(otherCost) || 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (total <= 0) {
      setError("报价总计必须大于 0");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/public/work-orders/${workOrderId}/quote?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractor_id: contractorId,
          labor_hours: parseFloat(laborHours) || 0,
          labor_rate: parseFloat(laborRate) || 0,
          materials,
          other_cost: parseFloat(otherCost) || 0,
          other_description: otherDescription || null,
          estimated_completion: estimatedCompletion || null,
          notes: notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAutoApproved(json.auto_approved ?? false);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <MobileLayout title="报价已提交">
        <div className="text-center space-y-4">
          <div className="text-3xl">✅</div>
          <h2 className="text-md font-semibold text-gray-900">报价已提交!</h2>
          <p className="text-sm text-gray-500">
            {autoApproved
              ? "报价已自动通过，请安排施工。"
              : "报价已提交，等待审批。"}
          </p>
        </div>
      </MobileLayout>
    );
  }

  const address = woInfo
    ? woInfo.unit ? `${woInfo.property_address}, ${woInfo.unit}` : woInfo.property_address
    : "";

  const CATEGORY_LABELS: Record<string, string> = {
    plumbing: "水管", electrical: "电路", hvac: "暖通", locks: "门锁", other: "其他",
  };

  // Step 1: Confirm acceptance
  if (woInfo && !accepted) {
    return (
      <MobileLayout title="新工单">
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-medium text-gray-400 mb-2">工单详情</h3>
            <div className="space-y-2 text-sm">
              <div><span className="text-gray-500">物业：</span><span className="text-gray-900 font-medium">{address}</span></div>
              <div><span className="text-gray-500">类别：</span>{CATEGORY_LABELS[woInfo.category] || woInfo.category}</div>
              <div><span className="text-gray-500">问题：</span>{woInfo.description}</div>
              {woInfo.urgency === "urgent" && (
                <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626]">紧急</span>
              )}
            </div>
          </div>
          {(woInfo.tenant_name || woInfo.tenant_phone) && (
            <div className="border-t border-[#F3F4F6] pt-3">
              <h3 className="text-xs font-medium text-gray-400 mb-2">租户信息</h3>
              <div className="space-y-1 text-sm">
                {woInfo.tenant_name && <div><span className="text-gray-500">姓名：</span>{woInfo.tenant_name}</div>}
                {woInfo.tenant_phone && <div><span className="text-gray-500">电话：</span>{woInfo.tenant_phone}</div>}
              </div>
            </div>
          )}
          {woInfo.photos && woInfo.photos.length > 0 && (
            <div className="border-t border-[#F3F4F6] pt-3">
              <h3 className="text-xs font-medium text-gray-400 mb-2">现场照片</h3>
              <div className="flex flex-wrap gap-2">
                {woInfo.photos.map((p: string, i: number) => (
                  <img key={i} src={p} alt={`照片${i+1}`} className="w-20 h-20 object-cover rounded-md border border-gray-200" />
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-error">{error}</p>}
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full h-10 bg-brand-600 text-white text-sm font-medium rounded-md
                       hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {accepting ? "确认中..." : "确认接单"}
          </button>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="维修报价提交">
      {/* Work order info */}
      {woInfo && (
        <div className="mb-4 pb-4 border-b border-[#F3F4F6]">
          <h3 className="text-xs font-medium text-gray-400 mb-1">工单信息</h3>
          <div className="text-sm font-medium text-gray-900">{address}</div>
          <div className="text-sm text-gray-600 mt-0.5">{woInfo.description}</div>
          {woInfo.urgency === "urgent" && (
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626]">
              紧急
            </span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Materials */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">材料费</label>
          {materials.map((m, i) => (
            <div key={i} className="flex gap-2 mb-2 items-center">
              <input
                type="text"
                value={m.name}
                onChange={(e) => updateMaterial(i, "name", e.target.value)}
                placeholder="名称"
                className="flex-1 h-9 px-2 border border-[#E5E7EB] rounded-md text-sm
                           focus:outline-none focus:border-brand-600"
              />
              <input
                type="number"
                value={m.quantity}
                onChange={(e) => updateMaterial(i, "quantity", parseInt(e.target.value) || 0)}
                className="w-16 h-9 px-2 border border-[#E5E7EB] rounded-md text-sm text-center font-mono
                           focus:outline-none focus:border-brand-600"
                min={1}
              />
              <input
                type="number"
                value={m.unit_price || ""}
                onChange={(e) => updateMaterial(i, "unit_price", parseFloat(e.target.value) || 0)}
                placeholder="$单价"
                className="w-20 h-9 px-2 border border-[#E5E7EB] rounded-md text-sm font-mono
                           focus:outline-none focus:border-brand-600"
                min={0}
                step="0.01"
              />
              <button
                type="button"
                onClick={() => removeMaterial(i)}
                className="text-gray-400 hover:text-error text-sm"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addMaterial}
            className="text-sm text-brand-600 hover:text-brand-700"
          >
            + 添加材料
          </button>
          {materialsCost > 0 && (
            <div className="text-xs text-gray-500 mt-1">材料费小计：<span className="font-mono">${materialsCost.toFixed(2)}</span></div>
          )}
        </div>

        {/* Labor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">人工费</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="number"
                value={laborHours}
                onChange={(e) => setLaborHours(e.target.value)}
                placeholder="工时(h)"
                className="w-full h-9 px-3 border border-[#E5E7EB] rounded-md text-sm font-mono
                           focus:outline-none focus:border-brand-600"
                min={0}
                step="0.5"
              />
            </div>
            <div className="flex-1">
              <input
                type="number"
                value={laborRate}
                onChange={(e) => setLaborRate(e.target.value)}
                placeholder="$/h"
                className="w-full h-9 px-3 border border-[#E5E7EB] rounded-md text-sm font-mono
                           focus:outline-none focus:border-brand-600"
                min={0}
                step="0.01"
              />
            </div>
          </div>
          {laborCost > 0 && (
            <div className="text-xs text-gray-500 mt-1">人工费小计：<span className="font-mono">${laborCost.toFixed(2)}</span></div>
          )}
        </div>

        {/* Other cost */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">其他费用</label>
          <input
            type="number"
            value={otherCost}
            onChange={(e) => setOtherCost(e.target.value)}
            placeholder="$0"
            className="w-full h-9 px-3 border border-[#E5E7EB] rounded-md text-sm font-mono
                       focus:outline-none focus:border-brand-600"
            min={0}
            step="0.01"
          />
          <input
            type="text"
            value={otherDescription}
            onChange={(e) => setOtherDescription(e.target.value)}
            placeholder="说明（选填）"
            className="w-full h-9 px-3 mt-2 border border-[#E5E7EB] rounded-md text-sm
                       focus:outline-none focus:border-brand-600"
          />
        </div>

        {/* Total */}
        <div className="border-t border-[#E5E7EB] pt-3">
          <div className="flex justify-between text-md font-semibold">
            <span className="text-gray-700">总计</span>
            <span className="font-mono text-gray-900">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Estimated completion */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">预估完工日期 *</label>
          <input
            type="date"
            value={estimatedCompletion}
            onChange={(e) => setEstimatedCompletion(e.target.value)}
            required
            min={new Date().toISOString().split("T")[0]}
            className="w-full h-9 px-3 border border-[#E5E7EB] rounded-md text-sm
                       focus:outline-none focus:border-brand-600"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md text-sm resize-none
                       focus:outline-none focus:border-brand-600 placeholder:text-gray-400"
            placeholder="备注信息（选填）"
          />
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-10 bg-brand-600 text-white text-sm font-medium rounded-md
                     hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "提交中..." : "提交报价"}
        </button>
      </form>
    </MobileLayout>
  );
}

export default function QuotePageWrapper() {
  return (
    <Suspense>
      <QuotePage />
    </Suspense>
  );
}
