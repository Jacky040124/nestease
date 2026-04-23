"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Logo } from "@/components/logo";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error);
        setLoading(false);
      } else {
        router.push("/dashboard");
        // Safety: reset loading in case navigation is interrupted
        setTimeout(() => setLoading(false), 3000);
      }
    } catch {
      setError("登录失败，请稍后再试");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — brand panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-brand-800">
        <img src="/login-bg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-brand-900/60" />
        <div className="relative flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <Logo size={28} fillOpacity={0.25} />
            <span className="text-lg font-bold tracking-tight">栖安</span>
          </div>

          <div className="max-w-md">
            <h2 className="text-3xl font-bold leading-snug">
              物业管理，一个平台全搞定
            </h2>
            <p className="mt-4 text-white/70 text-base leading-relaxed">
              工单、账目、报告、招租，AI 驱动全流程。
              <br />
              为华人物管团队打造。
            </p>
          </div>

          <p className="text-sm text-white/40">© 2026 栖安 NestEase</p>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center bg-white px-6">
        <div className="w-full max-w-sm">
          {/* Mobile-only brand header */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-2 text-brand-600 mb-2">
              <Logo size={24} />
              <span className="text-xl font-bold tracking-tight">栖安</span>
            </div>
            <p className="text-sm text-gray-500">AI 物业管理平台</p>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block mb-8">
            <h1 className="text-2xl font-bold text-gray-900">欢迎回来</h1>
            <p className="text-sm text-gray-500 mt-1">登录您的栖安账号</p>
          </div>

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

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  密码
                </label>
                <Link href="/forgot-password" className="text-xs text-brand-600 hover:text-brand-700">
                  忘记密码？
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-10 px-3 border border-gray-200 rounded-lg text-base
                           focus:outline-none focus:border-brand-600 focus:shadow-[var(--shadow-focus)]
                           placeholder:text-gray-400 transition-colors"
                placeholder="输入密码"
              />
            </div>

            {error && (
              <p className="text-sm text-error">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-brand-600 text-white text-sm font-semibold rounded-lg
                         hover:bg-brand-700 active:bg-brand-800
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors duration-[var(--duration-fast)]"
            >
              {loading ? "登录中..." : "登录"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            还没有账号？
            <Link href="/register" className="text-brand-600 hover:text-brand-700 ml-1">
              注册新账号
            </Link>
          </p>

          <p className="text-center text-xs text-gray-400 mt-3">
            工人？
            <Link href="/login/contractor" className="text-brand-600 hover:text-brand-700 ml-1">
              工人登录入口
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
