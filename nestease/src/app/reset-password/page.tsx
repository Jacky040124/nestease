"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/logo";
import Link from "next/link";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessToken = searchParams.get("access_token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "重置失败");
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
              设置新密码
            </h2>
            <p className="mt-4 text-white/70 text-base leading-relaxed">
              输入您的新密码，完成重置。
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
            <h1 className="text-2xl font-bold text-gray-900">重置密码</h1>
            <p className="text-sm text-gray-500 mt-1">输入您的新密码</p>
          </div>

          {success ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">密码已重置</h2>
              <p className="text-sm text-gray-500">
                您的密码已成功更新，请使用新密码登录。
              </p>
              <Link
                href="/login"
                className="inline-block w-full h-10 leading-10 bg-brand-600 text-white text-sm font-semibold rounded-lg
                           hover:bg-brand-700 active:bg-brand-800 transition-colors text-center"
              >
                前往登录
              </Link>
            </div>
          ) : (
            <>
              {!accessToken && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    链接无效或已过期。请重新
                    <Link href="/forgot-password" className="text-brand-600 hover:text-brand-700 ml-1">
                      申请重置密码
                    </Link>
                    。
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    新密码
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full h-10 px-3 border border-gray-200 rounded-lg text-base
                               focus:outline-none focus:border-brand-600 focus:shadow-[var(--shadow-focus)]
                               placeholder:text-gray-400 transition-colors"
                    placeholder="至少 6 位"
                  />
                </div>

                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
                    确认新密码
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full h-10 px-3 border border-gray-200 rounded-lg text-base
                               focus:outline-none focus:border-brand-600 focus:shadow-[var(--shadow-focus)]
                               placeholder:text-gray-400 transition-colors"
                    placeholder="再次输入新密码"
                  />
                </div>

                {error && <p className="text-sm text-error">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !accessToken}
                  className="w-full h-10 bg-brand-600 text-white text-sm font-semibold rounded-lg
                             hover:bg-brand-700 active:bg-brand-800
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors duration-[var(--duration-fast)]"
                >
                  {loading ? "重置中..." : "重置密码"}
                </button>
              </form>

              <p className="text-center text-xs text-gray-400 mt-6">
                <Link href="/login" className="text-brand-600 hover:text-brand-700">
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
