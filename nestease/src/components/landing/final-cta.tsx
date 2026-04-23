"use client";

import { useState, FormEvent } from "react";
import { BOOK_DEMO_URL } from "./use-fade-in";

export function FinalCTA() {
  const [name, setName] = useState("");
  const [wechat, setWechat] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !wechat.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), wechat_id: wechat.trim() }),
      });
      if (!res.ok) throw new Error("提交失败");
      setSubmitted(true);
    } catch {
      setError("提交失败，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-20 px-6 bg-brand-900">
      <div className="max-w-[720px] mx-auto text-center">
        <h2 className="text-2xl font-bold text-white mb-4">
          准备好升级你的物管效率了吗？
        </h2>
        <p className="text-md text-white/80 mb-8">
          预约 15 分钟演示，了解栖安如何帮你告别物管混乱。
        </p>

        <a
          href={BOOK_DEMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="h-11 px-8 inline-flex items-center bg-white text-brand-900 text-base font-semibold rounded-md hover:bg-gray-100 transition-colors"
        >
          预约演示
        </a>

        <div className="mt-10 pt-8 border-t border-white/20">
          <p className="text-sm text-white/60 mb-4">或留下您的微信号，我们主动联系您</p>

          {submitted ? (
            <p className="text-sm text-white/80 font-medium">已收到，我们会尽快联系您！</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <label htmlFor="cta-name" className="sr-only">姓名</label>
              <input
                id="cta-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="您的姓名"
                required
                className="flex-1 h-10 px-4 rounded-md text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <label htmlFor="cta-wechat" className="sr-only">微信号</label>
              <input
                id="cta-wechat"
                type="text"
                value={wechat}
                onChange={(e) => setWechat(e.target.value)}
                placeholder="微信号"
                required
                className="flex-1 h-10 px-4 rounded-md text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <button
                type="submit"
                disabled={submitting}
                className="h-10 px-6 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700 disabled:opacity-50 transition-colors shrink-0"
              >
                {submitting ? "提交中..." : "提交"}
              </button>
            </form>
          )}
          {error && <p className="text-sm text-red-300 mt-2">{error}</p>}
        </div>
      </div>
    </section>
  );
}
