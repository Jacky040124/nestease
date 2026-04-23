"use client";

import { useState, FormEvent } from "react";

export function ComingSoonBanner({ feature }: { feature?: string }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), interest: feature }),
      });
      if (res.ok) setSubmitted(true);
    } catch {
      // silent fail
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
      <div className="flex items-center gap-3">
        <span className="text-lg shrink-0" role="img" aria-label="施工中">🚧</span>
        <p className="text-sm text-amber-800 font-medium flex-1">
          此功能正在开发中，以下为功能预览。
        </p>
      </div>
      {submitted ? (
        <p className="text-xs text-amber-700 mt-2 ml-8">已加入等候名单，上线后将第一时间通知您。</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2 ml-8">
          <label htmlFor="waitlist-email" className="sr-only">邮箱</label>
          <input
            id="waitlist-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="输入邮箱，加入等候名单"
            required
            className="h-7 px-2.5 text-xs rounded border border-amber-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-400 flex-1 max-w-[260px]"
          />
          <button
            type="submit"
            disabled={submitting}
            className="h-7 px-3 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded transition-colors disabled:opacity-50"
          >
            {submitting ? "..." : "加入等候名单"}
          </button>
        </form>
      )}
    </div>
  );
}
