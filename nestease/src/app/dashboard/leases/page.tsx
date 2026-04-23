"use client";

import { ComingSoonBanner } from "@/components/coming-soon-banner";

const EXPIRING = [
  { tenant: "李明", property: "3488 Crowley Dr #2201", date: "05-15", rent: "$2,800", months: 11 },
  { tenant: "王芳", property: "888 Demo St #1", date: "06-01", rent: "$3,200", months: 8 },
];

const ALL_LEASES = [
  { tenant: "李明", property: "3488 Crowley Dr", rent: "$2,800", expires: "05-15", status: "warning" },
  { tenant: "王芳", property: "888 Demo St #1", rent: "$3,200", expires: "06-01", status: "warning" },
  { tenant: "张华", property: "1200 West Georgia", rent: "$3,500", expires: "09-30", status: "ok" },
  { tenant: "陈静", property: "888 Demo St #2", rent: "$2,600", expires: "12-01", status: "ok" },
];

const DEPOSITS = [
  { tenant: "李明", property: "3488 Crowley Dr", deposit: "$2,800", status: "持有中" },
  { tenant: "王芳", property: "888 Demo St #1", deposit: "$3,200", status: "持有中" },
  { tenant: "张华", property: "1200 West Georgia", deposit: "$3,500", status: "持有中" },
  { tenant: "陈静", property: "888 Demo St #2", deposit: "$2,600", status: "持有中" },
];

export default function LeasesPage() {
  return (
    <div className="h-full overflow-auto bg-[#F8F9FA] p-6">
      <div className="max-w-[1000px] mx-auto">
        <ComingSoonBanner feature="租约管理" />

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">租约管理</h1>
          <button className="h-8 px-4 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors">
            + 新增租约
          </button>
        </div>

        {/* Expiring soon */}
        <div className="bg-white rounded-xl border border-amber-200 shadow-xs p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">预警</span>
            <h2 className="text-sm font-semibold text-gray-900">{EXPIRING.length} 份租约将在 60 天内到期</h2>
          </div>
          <div className="space-y-3">
            {EXPIRING.map((l) => (
              <div key={l.tenant} className="p-3 rounded-lg bg-amber-50/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{l.tenant} &middot; {l.property}</span>
                  <span className="text-xs text-amber-600 font-medium">到期 {l.date}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">月租 {l.rent} &middot; 已住 {l.months} 个月</span>
                  <div className="flex gap-2">
                    <button className="text-[10px] font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded">续约</button>
                    <button className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">不续约</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* All leases */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">所有租约</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-medium text-gray-500">租户</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">物业</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">月租</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">到期</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">状态</th>
                </tr>
              </thead>
              <tbody>
                {ALL_LEASES.map((l) => (
                  <tr key={l.tenant} className="border-b border-gray-50">
                    <td className="py-2.5 text-gray-900">{l.tenant}</td>
                    <td className="py-2.5 text-gray-600">{l.property}</td>
                    <td className="py-2.5 text-gray-900 font-medium">{l.rent}</td>
                    <td className="py-2.5 text-gray-600">{l.expires}</td>
                    <td className="py-2.5">
                      {l.status === "warning"
                        ? <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">即将到期</span>
                        : <span className="text-[10px] font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">正常</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deposits */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">押金管理</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-medium text-gray-500">租户</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">物业</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">押金</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">状态</th>
                </tr>
              </thead>
              <tbody>
                {DEPOSITS.map((d) => (
                  <tr key={d.tenant} className="border-b border-gray-50">
                    <td className="py-2.5 text-gray-900">{d.tenant}</td>
                    <td className="py-2.5 text-gray-600">{d.property}</td>
                    <td className="py-2.5 text-gray-900 font-medium">{d.deposit}</td>
                    <td className="py-2.5 text-gray-500">{d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
