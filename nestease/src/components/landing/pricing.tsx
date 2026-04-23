"use client";

import { useFadeIn } from "./use-fade-in";

interface Plan {
  name: string;
  price: number;
  desc: string;
  features: string[];
  highlight?: boolean;
  cta: string;
}

const plans: Plan[] = [
  {
    name: "Starter",
    price: 29,
    desc: "适合管理少量物业的个人 PM",
    features: [
      "工单管理（无限工单）",
      "基础账目管理",
      "短信/邮件通知",
      "最多 20 套物业",
    ],
    cta: "开始免费试用",
  },
  {
    name: "Pro",
    price: 59,
    desc: "适合专业物管团队",
    features: [
      "Starter 全部功能",
      "AI 自动业主报告",
      "Contractor 管理与评分",
      "业主 Portal",
      "租约 & 招租管理",
      "最多 100 套物业",
    ],
    highlight: true,
    cta: "开始免费试用",
  },
  {
    name: "Growth",
    price: 99,
    desc: "适合多团队大规模管理",
    features: [
      "Pro 全部功能",
      "多团队协作",
      "API 集成",
      "高级数据分析",
      "无套数限制",
      "优先客服支持",
    ],
    cta: "联系我们",
  },
];

export function Pricing() {
  const fade = useFadeIn();

  return (
    <section id="pricing" className="py-20 px-6">
      <div ref={fade.ref} className={`max-w-[1200px] mx-auto ${fade.className}`}>
        <div className="text-center mb-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            简单透明的定价
          </h2>
          <p className="text-sm text-gray-500">
            所有方案均含 14 天免费试用，无需绑定信用卡。
          </p>
          <span className="inline-block mt-3 text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
            早鸟优惠价，名额有限
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[960px] mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border p-6 flex flex-col ${
                plan.highlight
                  ? "border-brand-600 shadow-md ring-1 ring-brand-600 relative"
                  : "border-gray-200 shadow-xs"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-white bg-brand-600 px-3 py-1 rounded-full">
                  最受欢迎
                </span>
              )}
              <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">{plan.desc}</p>
              <div className="mb-6">
                <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                <span className="text-sm text-gray-400 ml-1">/月</span>
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/register"
                className={`h-10 flex items-center justify-center text-sm font-semibold rounded-lg transition-colors ${
                  plan.highlight
                    ? "bg-brand-600 text-white hover:bg-brand-700"
                    : "border border-brand-600 text-brand-600 hover:bg-brand-50"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
