"use client";

import { useFadeIn } from "./use-fade-in";

export function SocialProof() {
  const fade = useFadeIn();
  return (
    <section className="py-20 px-6 bg-gray-50">
      <div ref={fade.ref} className={`max-w-[1200px] mx-auto ${fade.className}`}>
        <h2 className="text-xl font-semibold text-gray-900 text-center mb-12">
          温哥华物管团队的首选
        </h2>

        {/* Testimonial card */}
        <div className="max-w-[720px] mx-auto bg-white rounded-xl p-8 shadow-xs border border-gray-100">
          <p className="text-md text-gray-900 leading-relaxed">
            &ldquo;以前每天花两个小时在微信上转发报修信息和照片，现在租户自己提交，系统自动通知师傅，我只需要在看板上看一眼。账目功能上线后我第一个用。&rdquo;
          </p>
          <p className="mt-4 text-sm text-gray-400">— H.L.，物业经理，温哥华</p>
        </div>

        {/* Stats */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-12 mt-12">
          <div className="text-center">
            <div className="text-2xl font-bold text-brand-600">200+</div>
            <div className="text-sm text-gray-500 mt-1">管理物业套数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-brand-600">60%</div>
            <div className="text-sm text-gray-500 mt-1">平均响应时间缩短</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-brand-600">$20/月</div>
            <div className="text-sm text-gray-500 mt-1">用户愿付价格验证</div>
          </div>
        </div>
      </div>
    </section>
  );
}
