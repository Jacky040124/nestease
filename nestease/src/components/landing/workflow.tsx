"use client";

import { useFadeIn } from "./use-fade-in";

export function Workflow() {
  const fade = useFadeIn();
  const steps = [
    { num: "1", title: "租户报修", desc: "租户通过链接提交报修，附照片和描述。" },
    { num: "2", title: "PM 派单", desc: "PM 在看板上指派师傅，一键派单。" },
    { num: "3", title: "师傅施工", desc: "师傅报价、施工、提交完工报告。" },
    { num: "4", title: "验收完成", desc: "租户确认问题解决，工单关闭。" },
  ];

  return (
    <section id="workflow" className="py-20 px-6 bg-gray-50">
      <div ref={fade.ref} className={`max-w-[1200px] mx-auto ${fade.className}`}>
        <h2 className="text-xl font-semibold text-gray-900 text-center mb-16">
          从报修到完工，四步搞定
        </h2>

        {/* Desktop: horizontal */}
        <div className="hidden md:flex items-start justify-between">
          {steps.map((step, i) => (
            <div key={step.num} className="flex-1 flex flex-col items-center text-center relative">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="absolute top-5 left-[calc(50%+24px)] right-[calc(-50%+24px)] h-px bg-brand-200" />
              )}
              <div className="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-bold relative z-10">
                {step.num}
              </div>
              <h3 className="mt-4 text-md font-semibold text-gray-900">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-500 max-w-[200px] leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Mobile: vertical timeline */}
        <div className="md:hidden space-y-0">
          {steps.map((step, i) => (
            <div key={step.num} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {step.num}
                </div>
                {i < steps.length - 1 && <div className="w-px flex-1 bg-brand-200" />}
              </div>
              <div className="pb-8">
                <h3 className="text-md font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
