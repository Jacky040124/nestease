"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS } from "@/lib/labels";

interface PendingWorkOrder {
  id: string;
  status: string;
  property_address: string;
  category: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  assigned: "待报价",
  quoting: "报价中",
  in_progress: "施工中",
  pending_verification: "待验收",
};

export default function ContractorHomePage() {
  const router = useRouter();
  const [contractorName, setContractorName] = useState("");
  const [workOrders, setWorkOrders] = useState<PendingWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("contractor_token");
    if (!token) {
      router.push("/login/contractor");
      return;
    }

    fetch("/api/auth/contractor/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 401) {
          localStorage.removeItem("contractor_token");
          router.push("/login/contractor");
          return;
        }
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          setError(`加载失败 (${res.status})`);
          console.error("contractor/me error:", res.status, text);
          return;
        }
        const data = await res.json();
        setContractorName(data.contractor?.name || "");
        setWorkOrders(data.pending_work_orders || []);
      })
      .catch((err) => {
        setError("加载失败");
        console.error("contractor/me fetch error:", err);
      })
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("contractor_token");
    router.push("/login/contractor");
  }

  function getActionPath(wo: PendingWorkOrder): string | null {
    if (wo.status === "assigned" || wo.status === "quoting") {
      return `/contractor/quote/${wo.id}`;
    }
    if (wo.status === "in_progress") {
      return `/contractor/completion-report/${wo.id}`;
    }
    // pending_verification: no action needed, contractor waits for tenant
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-sm text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">
            您好，{contractorName}
          </h1>
          <p className="text-xs text-gray-400">栖安工人平台</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          登出
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Work orders */}
      <div className="p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          待处理工单 ({workOrders.length})
        </h2>

        {workOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
            <p className="text-sm text-gray-400">暂无待处理工单</p>
          </div>
        ) : (
          <div className="space-y-3">
            {workOrders.map((wo) => {
              const actionPath = getActionPath(wo);
              const CardTag = actionPath ? "button" : "div";
              return (
                <CardTag
                  key={wo.id}
                  onClick={actionPath ? () => router.push(actionPath) : undefined}
                  className={`w-full bg-white rounded-xl border border-[#E5E7EB] p-4 text-left
                    ${actionPath ? "hover:border-brand-300 cursor-pointer" : ""} transition-colors`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {wo.property_address}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      wo.status === "pending_verification"
                        ? "bg-blue-50 text-blue-600"
                        : "bg-amber-50 text-amber-600"
                    }`}>
                      {STATUS_LABELS[wo.status] || wo.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{CATEGORY_LABELS[wo.category] ?? wo.category}</span>
                    <span>{new Date(wo.created_at).toLocaleDateString()}</span>
                  </div>
                  {wo.status === "pending_verification" && (
                    <div className="mt-2 text-xs text-blue-500">等待租户验收中</div>
                  )}
                </CardTag>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
