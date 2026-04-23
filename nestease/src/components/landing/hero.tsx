"use client";

import { useFadeIn, BOOK_DEMO_URL } from "./use-fade-in";

interface HeroCard { addr: string; desc: string; tag: string; tagColor: string; time: string; contractor?: string; photos?: number; quote?: string }
export function HeroKanban() {
  const columns: { label: string; dot: string; cards: HeroCard[] }[] = [
    { label: "待分配", dot: "bg-gray-400", cards: [
      { addr: "888 Nelson St, 1502", desc: "主卧门把手松动，需要更换", tag: "紧急", tagColor: "bg-red-50 text-red-600", time: "刚刚", photos: 3 },
      { addr: "888 Nelson St, 1501", desc: "热水器不出热水，只有冷水", tag: "普通", tagColor: "bg-gray-100 text-gray-500", time: "12分钟前" },
      { addr: "1234 West Broadway, 101", desc: "厨房水龙头漏水，水流不止", tag: "紧急", tagColor: "bg-red-50 text-red-600", time: "1小时前", photos: 1 },
    ]},
    { label: "已派单", dot: "bg-blue-500", cards: [
      { addr: "2080 W 4th Ave, B", desc: "空调制冷效果差，温度降不下来", tag: "普通", tagColor: "bg-gray-100 text-gray-500", time: "昨天", contractor: "李师傅" },
      { addr: "2080 W 4th Ave, A", desc: "阳台推拉门卡住，无法关闭", tag: "紧急", tagColor: "bg-red-50 text-red-600", time: "2小时前", contractor: "张师傅", photos: 2 },
      { addr: "1234 West Broadway, 102", desc: "客厅灯开关失灵，接了没反应", tag: "普通", tagColor: "bg-gray-100 text-gray-500", time: "3小时前", contractor: "王师傅" },
    ]},
    { label: "报价中", dot: "bg-purple-500", cards: [
      { addr: "3456 Main St, 302", desc: "地板翘起有裂缝，影响走路", tag: "普通", tagColor: "bg-gray-100 text-gray-500", time: "今天 14:30", contractor: "陈师傅" },
      { addr: "3456 Main St, 301", desc: "窗户密封条脱落，漏风严重", tag: "紧急", tagColor: "bg-red-50 text-red-600", time: "今天 11:20", contractor: "张师傅", photos: 4 },
      { addr: "1234 West Broadway, 201", desc: "暖气片不热，温度上不去", tag: "普通", tagColor: "bg-gray-100 text-gray-500", time: "昨天", contractor: "刘师傅" },
    ]},
    { label: "待审批", dot: "bg-amber-500", cards: [
      { addr: "1688 Alberni St, 801", desc: "门禁系统故障，无法刷卡", tag: "紧急", tagColor: "bg-red-50 text-red-600", time: "30分钟前", contractor: "王师傅", quote: "$320" },
      { addr: "888 Nelson St, 1401", desc: "洗碗机排水问题，积水严重", tag: "普通", tagColor: "bg-gray-100 text-gray-500", time: "今天 09:15", contractor: "李师傅", quote: "$180" },
    ]},
    { label: "施工中", dot: "bg-brand-600", cards: [
      { addr: "1300 Burrard St, PH2", desc: "主卫漏水到楼下，需紧急处理", tag: "紧急", tagColor: "bg-red-50 text-red-600", time: "昨天", contractor: "张师傅", photos: 5 },
      { addr: "1455 Howe St, 1101", desc: "厨房排气扇噪音大", tag: "普通", tagColor: "bg-gray-100 text-gray-500", time: "3天前", contractor: "陈师傅" },
      { addr: "1500 Robson St, 601", desc: "车库门遥控器失灵", tag: "普通", tagColor: "bg-gray-100 text-gray-500", time: "4天前", contractor: "刘师傅", photos: 1 },
    ]},
    { label: "待验收", dot: "bg-orange-500", cards: [
      { addr: "1600 Beach Ave, C", desc: "浴室瓷砖裂缝已修补", tag: "普通", tagColor: "bg-gray-100 text-gray-500", time: "今天 16:00", contractor: "王师傅", photos: 3 },
      { addr: "1850 Comox St, 202", desc: "电路跳闸问题已修复", tag: "紧急", tagColor: "bg-red-50 text-red-600", time: "昨天", contractor: "李师傅", photos: 2 },
    ]},
    { label: "已完成", dot: "bg-green-500", cards: [
      { addr: "1234 West Broadway, 301", desc: "地下室水管爆裂已修复", tag: "普通", tagColor: "bg-gray-100 text-gray-500", time: "4月8日", contractor: "张师傅" },
      { addr: "2080 W 4th Ave, D", desc: "烟雾报警器更换完成", tag: "普通", tagColor: "bg-gray-100 text-gray-500", time: "4月7日" },
      { addr: "3456 Main St, 201", desc: "门锁更换完毕", tag: "普通", tagColor: "bg-gray-100 text-gray-500", time: "4月5日", contractor: "刘师傅" },
    ]},
  ];

  return (
    <div className="relative h-[380px] overflow-hidden bg-[#FAFBFC]">
      {/* Auto-scroll container */}
      <div
        className="flex gap-4 p-5 absolute top-0 left-0 animate-[heroScroll_25s_linear_infinite]"
        style={{ width: `${columns.length * 256 + (columns.length - 1) * 16 + 40}px` }}
      >
        {columns.map((col) => (
          <div key={col.label} className="w-[244px] shrink-0">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className={`w-2.5 h-2.5 rounded-full ${col.dot} ring-2 ring-white shadow-sm`} />
              <span className="text-xs font-semibold text-gray-800">{col.label}</span>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-medium">{col.cards.length}</span>
            </div>
            <div className="space-y-2.5">
              {col.cards.map((card) => (
                <div key={card.addr} className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${card.tagColor}`}>{card.tag}</span>
                    <span className="text-[9px] text-gray-300 font-light">{card.time}</span>
                  </div>
                  <div className="text-[11px] font-semibold text-gray-800 truncate leading-snug">{card.addr}</div>
                  <div className="text-[10px] text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{card.desc}</div>
                  {(card.contractor || card.photos || card.quote) && (
                    <div className="flex items-center gap-2.5 mt-2.5 pt-2 border-t border-gray-50">
                      {card.contractor && (
                        <span className="flex items-center gap-1 text-[9px] text-gray-400">
                          <svg className="w-2.5 h-2.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          {card.contractor}
                        </span>
                      )}
                      {card.quote && (
                        <span className="text-[9px] font-medium text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">{card.quote}</span>
                      )}
                      {card.photos && (
                        <span className="flex items-center gap-0.5 text-[9px] text-gray-300 ml-auto">
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                          {card.photos}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Fade edges */}
      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#FAFBFC] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#FAFBFC] to-transparent z-10 pointer-events-none" />
    </div>
  );
}

export function Hero() {
  const fade = useFadeIn();
  return (
    <section className="pt-32 pb-20 px-6">
      <div ref={fade.ref} className={`max-w-[1200px] mx-auto text-center ${fade.className}`}>
        <h1 className="text-3xl font-bold text-gray-900 leading-tight">
          物业管理，一个平台全搞定
        </h1>
        <p className="mt-4 text-md text-gray-500 max-w-[560px] mx-auto leading-relaxed">
          从收租到维修，从招租到报告。AI 驱动的全平台物管系统，为华人物管团队打造。
        </p>
        <div className="mt-4 flex items-center justify-center gap-3 text-xs text-gray-400">
          <span>温哥华本地团队</span>
          <span aria-hidden>·</span>
          <span>中英双语</span>
          <span aria-hidden>·</span>
          <span>免费试用</span>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="/register"
            className="h-11 px-8 inline-flex items-center bg-brand-600 text-white text-base font-semibold rounded-md hover:bg-brand-700 transition-colors"
          >
            免费试用
          </a>
          <a
            href={BOOK_DEMO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 px-8 inline-flex items-center border-2 border-brand-600 text-brand-600 text-base font-semibold rounded-md hover:bg-brand-50 transition-colors"
          >
            预约演示
          </a>
        </div>

        {/* Product screenshot — auto-scrolling kanban */}
        <div className="mt-12 max-w-[1100px] mx-auto rounded-xl shadow-lg border border-gray-200/60 overflow-hidden bg-white">
          <HeroKanban />
        </div>
      </div>
    </section>
  );
}
