"use client";

import { ComingSoonBanner } from "@/components/coming-soon-banner";

const REPORTS = [
  { title: "2026年3月 月度报告", owner: "周建华", property: "3488 Crowley Dr", date: "04-01", status: "已发送", statusColor: "text-brand-600" },
  { title: "2026年3月 月度报告", owner: "李雪梅", property: "888 Demo St", date: "04-01", status: "待发送", statusColor: "text-amber-600" },
  { title: "2026年Q1 季度报告", owner: "周建华", property: "3488 Crowley Dr", date: "04-02", status: "已发送", statusColor: "text-brand-600" },
];

export default function ReportsPage() {
  return (
    <div className="h-full overflow-auto bg-[#F8F9FA] p-6">
      <div className="max-w-[1000px] mx-auto">
        <ComingSoonBanner feature="业主报告" />

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">业主报告</h1>
          <div className="flex gap-2">
            <button className="h-8 px-4 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors">
              生成月报
            </button>
            <button className="h-8 px-4 text-xs font-semibold text-brand-600 border border-brand-600 rounded-lg hover:bg-brand-50 transition-colors">
              生成季报
            </button>
          </div>
        </div>

        {/* Report list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">报告列表</h2>
          <div className="space-y-3">
            {REPORTS.map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{r.title} — {r.owner} ({r.property})</div>
                  <div className="text-xs text-gray-500 mt-0.5">生成于 {r.date}</div>
                </div>
                <span className={`text-xs font-medium ${r.statusColor} shrink-0`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI report preview */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">报告预览（AI 生成）</h2>
          <div className="bg-gray-50 rounded-lg p-5 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">2026年3月 月度物业报告</h3>
              <p className="text-xs text-gray-500">物业：3488 Crowley Dr, Vancouver &middot; 业主：周建华</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">AI 摘要</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                本月物业运营正常。完成 1 笔维修（厨房水龙头更换，$450）。租金按时收取。建议关注卫生间排水管道，上次维修距今已 4 个月。
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">财务概览</h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">租金收入</span><span className="text-gray-900">$2,800</span></div>
                <div className="flex justify-between"><span className="text-gray-600">维修支出</span><span className="text-gray-900">$450</span></div>
                <div className="flex justify-between"><span className="text-gray-600">管理费 (8%)</span><span className="text-gray-900">$224</span></div>
                <div className="flex justify-between border-t border-gray-200 pt-1.5"><span className="text-gray-900 font-medium">净收入</span><span className="font-bold text-brand-600">$2,126</span></div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">维修记录</h4>
              <p className="text-sm text-gray-600">04-08 厨房水龙头更换 — 张师傅 — $450</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">物业照片</h4>
              <div className="flex gap-2">
                {["客厅", "厨房", "卫生间"].map((room) => (
                  <div key={room} className="w-20 h-16 rounded-md bg-gray-200 border border-gray-300 flex items-center justify-center">
                    <span className="text-[9px] text-gray-500">{room}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button className="h-8 px-4 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors">
                下载 PDF
              </button>
              <button className="h-8 px-4 text-xs font-semibold text-brand-600 border border-brand-600 rounded-lg hover:bg-brand-50 transition-colors">
                发送给业主
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
