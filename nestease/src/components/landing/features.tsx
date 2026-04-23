"use client";

import { useFadeIn, BOOK_DEMO_URL } from "./use-fade-in";

interface FeatureModule {
  title: string;
  desc: string;
  tag: string;
  tagColor: string;
  icon: React.ReactNode;
}

const modules: FeatureModule[] = [
  {
    title: "看板式工单管理",
    desc: "报修、派单、报价、审批、施工、验收，全流程在一个看板上完成。拖拽即可推进，自动通知各方。",
    tag: "已上线",
    tagColor: "bg-brand-50 text-brand-600",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  {
    title: "收租与财务一目了然",
    desc: "自动追踪每套房的租金状态，逾期自动提醒。月度财务报表一键生成，告别 Excel 对账。",
    tag: "即将上线",
    tagColor: "bg-amber-50 text-amber-600",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    title: "师傅团队，高效管理",
    desc: "建立你的师傅档案库。历史报价、完工评分、擅长领域一目了然，派单时智能推荐。",
    tag: "即将上线",
    tagColor: "bg-amber-50 text-amber-600",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-5.1m0 0L12 4.37m-5.68 5.7h15.08M20.58 8.83l5.1 5.1m0 0L20 19.63m5.68-5.7H10.6" />
      </svg>
    ),
  },
  {
    title: "AI 自动生成业主报告",
    desc: "维修记录、财务数据、房屋照片自动整合，生成专业的月报和季度巡检报告。房东不用问，你也不用做。",
    tag: "即将上线",
    tagColor: "bg-amber-50 text-amber-600",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    title: "租约到期，提前掌握",
    desc: "租客档案、合同信息、到期提醒集中管理。续约还是招租，提前 60 天预警。",
    tag: "即将上线",
    tagColor: "bg-amber-50 text-amber-600",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    title: "从挂牌到签约，流程化招租",
    desc: "房源发布、看房预约、申请审核、签约入住，每一步都有系统跟进。",
    tag: "即将上线",
    tagColor: "bg-amber-50 text-amber-600",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
];

export function Features() {
  const fade = useFadeIn();

  return (
    <section id="features" className="py-20 px-6">
      <div ref={fade.ref} className={`max-w-[1200px] mx-auto ${fade.className}`}>
        <h2 className="text-xl font-semibold text-gray-900 text-center mb-4">
          六大模块，覆盖物管全场景
        </h2>
        <p className="text-sm text-gray-500 text-center mb-16 max-w-[480px] mx-auto">
          一个平台管理所有物业事务，不再在多个工具间切换。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((m) => (
            <div key={m.title} className="bg-white rounded-xl border border-gray-100 shadow-xs p-6 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600">
                  {m.icon}
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${m.tagColor}`}>
                  {m.tag}
                </span>
              </div>
              <h3 className="text-md font-semibold text-gray-900 mb-2">{m.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-16">
          <a
            href={BOOK_DEMO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 px-8 inline-flex items-center border-2 border-brand-600 text-brand-600 text-sm font-semibold rounded-md hover:bg-brand-50 transition-colors"
          >
            预约演示，了解更多
          </a>
        </div>
      </div>
    </section>
  );
}
