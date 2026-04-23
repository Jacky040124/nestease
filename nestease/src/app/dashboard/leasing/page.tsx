"use client";

import { ComingSoonBanner } from "@/components/coming-soon-banner";

const FUNNEL = [
  { stage: "询盘", count: 8, width: "100%" },
  { stage: "看房", count: 3, width: "37.5%" },
  { stage: "申请", count: 1, width: "12.5%" },
  { stage: "签约", count: 0, width: "0%" },
];

const SHOWINGS = [
  { date: "04-13", items: [
    { time: "10:00 AM", name: "张先生", property: "888 Demo St #3" },
    { time: "2:00 PM", name: "李女士", property: "888 Demo St #3" },
  ]},
  { date: "04-15", items: [
    { time: "11:00 AM", name: "王先生", property: "888 Demo St #3" },
  ]},
];

export default function LeasingPage() {
  return (
    <div className="h-full overflow-auto bg-[#F8F9FA] p-6">
      <div className="max-w-[1000px] mx-auto">
        <ComingSoonBanner feature="招租管理" />

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">招租管理</h1>
          <button className="h-8 px-4 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors">
            + 发布房源
          </button>
        </div>

        {/* Vacant property */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">空置物业</h2>
          <div className="p-4 rounded-lg bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">888 Demo St #3</h3>
            <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
              <span>空置天数：12 天</span>
              <span>目标租金：$2,800</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-gray-600">询盘：<span className="font-semibold text-gray-900">8</span></span>
              <span className="text-gray-600">看房预约：<span className="font-semibold text-gray-900">3</span></span>
              <span className="text-gray-600">申请：<span className="font-semibold text-gray-900">1</span></span>
            </div>
          </div>
        </div>

        {/* Funnel */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">招租漏斗</h2>
          <div className="flex items-center gap-2 text-xs text-gray-600 mb-4">
            {FUNNEL.map((f, i) => (
              <span key={f.stage} className="flex items-center gap-1">
                {f.stage} ({f.count})
                {i < FUNNEL.length - 1 && <span className="text-gray-300 mx-1">→</span>}
              </span>
            ))}
          </div>
          <div className="space-y-2">
            {FUNNEL.map((f) => (
              <div key={f.stage} className="flex items-center gap-3">
                <span className="text-[10px] text-gray-500 w-10 shrink-0">{f.stage}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full flex items-center justify-end pr-2 ${f.count > 0 ? "bg-brand-200" : "bg-gray-200"}`}
                    style={{ width: f.count > 0 ? f.width : "8%" }}
                  >
                    <span className={`text-[9px] font-medium ${f.count > 0 ? "text-brand-700" : "text-gray-400"}`}>{f.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Showing schedule */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">看房日程</h2>
          <div className="space-y-4">
            {SHOWINGS.map((day) => (
              <div key={day.date}>
                <h3 className="text-xs font-semibold text-gray-700 mb-2">{day.date}</h3>
                <div className="space-y-2">
                  {day.items.map((item) => (
                    <div key={item.time + item.name} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                      <span className="text-xs font-medium text-brand-600 shrink-0">{item.time}</span>
                      <span className="text-sm text-gray-900">{item.name}</span>
                      <span className="text-xs text-gray-500">— {item.property}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
