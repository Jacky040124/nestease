"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Logo } from "@/components/logo";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, phone: phone || undefined }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "注册失败");
        setLoading(false);
        return;
      }

      // Auto-login with the credentials
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        // Registration succeeded but auto-login failed — redirect to login
        router.push("/login");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — brand panel */}
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
              开始使用栖安
              <br />
              一个平台管好所有物业
            </h2>
            <p className="mt-4 text-white/70 text-base leading-relaxed">
              注册账号，即刻体验 AI 驱动的物业管理。
            </p>
          </div>
          <p className="text-sm text-white/40">&copy; 2026 栖安 NestEase</p>
        </div>
      </div>

      {/* Right — register form */}
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
            <h1 className="text-2xl font-bold text-gray-900">创建账号</h1>
            <p className="text-sm text-gray-500 mt-1">注册您的栖安物业管理账号</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                姓名
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-10 px-3 border border-gray-200 rounded-lg text-base
                           focus:outline-none focus:border-brand-600 focus:shadow-[var(--shadow-focus)]
                           placeholder:text-gray-400 transition-colors"
                placeholder="您的姓名"
              />
            </div>

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
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                手机号
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full h-10 px-3 border border-gray-200 rounded-lg text-base
                           focus:outline-none focus:border-brand-600 focus:shadow-[var(--shadow-focus)]
                           placeholder:text-gray-400 transition-colors"
                placeholder="+1 778 123 4567"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                密码
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

            {error && <p className="text-sm text-error">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-brand-600 text-white text-sm font-semibold rounded-lg
                         hover:bg-brand-700 active:bg-brand-800
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors duration-[var(--duration-fast)]"
            >
              {loading ? "注册中..." : "注册"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            已有账号？
            <Link href="/login" className="text-brand-600 hover:text-brand-700 ml-1">
              登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
