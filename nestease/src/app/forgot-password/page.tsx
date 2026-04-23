"use client";

import { useState, FormEvent } from "react";
import { Logo } from "@/components/logo";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "发送失败");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-brand-800">
        <div className="flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <Logo size={28} fillOpacity={0.25} />
            <span className="text-lg font-bold tracking-tight">栖安</span>
          </div>
          <div className="max-w-md">
            <h2 className="text-3xl font-bold leading-snug">
              重置您的密码
            </h2>
            <p className="mt-4 text-white/70 text-base leading-relaxed">
              输入注册邮箱，我们会发送重置链接。
            </p>
          </div>
          <p className="text-sm text-white/40">&copy; 2026 栖安 NestEase</p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center bg-white px-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-2 text-brand-600 mb-2">
              <Logo size={24} />
              <span className="text-xl font-bold tracking-tight">栖安</span>
            </div>
            <p className="text-sm text-gray-500">AI 物业管理平台</p>
          </div>

          <div className="hidden lg:block mb-8">
            <h1 className="text-2xl font-bold text-gray-900">忘记密码</h1>
            <p className="text-sm text-gray-500 mt-1">输入邮箱，我们会发送重置链接</p>
          </div>

          {success ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">邮件已发送</h2>
              <p className="text-sm text-gray-500">
                如果该邮箱已注册，您将收到一封包含重置链接的邮件。请检查您的收件箱。
              </p>
              <Link
                href="/login"
                className="inline-block text-sm text-brand-600 hover:text-brand-700"
              >
                返回登录
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    邮箱
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full h-10 px-3 border border-gray-200 rounded-lg text-base
                               focus:outline-none focus:border-brand-600 focus:shadow-[var(--shadow-focus)]
                               placeholder:text-gray-400 transition-colors"
                    placeholder="your@email.com"
                  />
                </div>

                {error && <p className="text-sm text-error">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 bg-brand-600 text-white text-sm font-semibold rounded-lg
                             hover:bg-brand-700 active:bg-brand-800
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors duration-[var(--duration-fast)]"
                >
                  {loading ? "发送中..." : "发送重置链接"}
                </button>
              </form>

              <p className="text-center text-xs text-gray-400 mt-6">
                想起密码了？
                <Link href="/login" className="text-brand-600 hover:text-brand-700 ml-1">
                  返回登录
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
