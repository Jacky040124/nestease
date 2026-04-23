"use client";

import { ComingSoonBanner } from "@/components/coming-soon-banner";

const SUMMARY = [
  { label: "应收", value: "$35,000", color: "text-gray-900" },
  { label: "已收", value: "$33,250", color: "text-brand-600" },
  { label: "逾期", value: "$1,750", color: "text-red-500" },
  { label: "支出", value: "$4,200", color: "text-amber-600" },
];

const RENT_ROWS = [
  { property: "3488 Crowley Dr", tenant: "李明", rent: "$2,800", status: "已收", statusColor: "text-brand-600" },
  { property: "888 Demo St #1", tenant: "王芳", rent: "$3,200", status: "已收", statusColor: "text-brand-600" },
  { property: "888 Demo St #3", tenant: "王先生", rent: "$2,800", status: "逾期 5 天", statusColor: "text-red-500" },
  { property: "1200 West Georgia", tenant: "张华", rent: "$3,500", status: "已收", statusColor: "text-brand-600" },
  { property: "1455 Howe St #1101", tenant: "陈静", rent: "$2,600", status: "已收", statusColor: "text-brand-600" },
];

const EXPENSE_ROWS = [
  { date: "04-08", property: "3488 Crowley Dr", category: "维修", amount: "$450" },
  { date: "04-05", property: "888 Demo St #1", category: "清洁", amount: "$200" },
  { date: "04-01", property: "全部", category: "管理费", amount: "$3,550" },
];

export default function AccountingPage() {
  return (
    <div className="h-full overflow-auto bg-[#F8F9FA] p-6">
      <div className="max-w-[1000px] mx-auto">
        <ComingSoonBanner feature="账目管理" />

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">账目管理</h1>
          <div className="flex gap-2">
            <span className="text-xs text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-lg">本月</span>
            <span className="text-xs text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-lg">导出报表</span>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {SUMMARY.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-xs p-5">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Rent details */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">收租明细</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-medium text-gray-500">物业</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">租户</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">月租</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">状态</th>
                </tr>
              </thead>
              <tbody>
                {RENT_ROWS.map((r) => (
                  <tr key={r.property} className="border-b border-gray-50">
                    <td className="py-2.5 text-gray-900">{r.property}</td>
                    <td className="py-2.5 text-gray-600">{r.tenant}</td>
                    <td className="py-2.5 text-gray-900 font-medium">{r.rent}</td>
                    <td className={`py-2.5 font-medium ${r.statusColor}`}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expense records */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">支出记录</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-medium text-gray-500">日期</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">物业</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">类别</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">金额</th>
                </tr>
              </thead>
              <tbody>
                {EXPENSE_ROWS.map((e) => (
                  <tr key={e.date + e.property} className="border-b border-gray-50">
                    <td className="py-2.5 text-gray-500">{e.date}</td>
                    <td className="py-2.5 text-gray-900">{e.property}</td>
                    <td className="py-2.5 text-gray-600">{e.category}</td>
                    <td className="py-2.5 text-gray-900 font-medium">{e.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly report preview */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">月度财务报表预览</h2>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">本月总收入</span>
              <span className="font-semibold text-gray-900">$33,250</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">本月总支出</span>
              <span className="font-semibold text-gray-900">$4,200</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
              <span className="text-gray-900 font-medium">净收入</span>
              <span className="font-bold text-brand-600">$29,050</span>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button className="h-8 px-4 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors">
              下载 PDF 报表
            </button>
            <button className="h-8 px-4 text-xs font-semibold text-brand-600 border border-brand-600 rounded-lg hover:bg-brand-50 transition-colors">
              发送给房东
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
