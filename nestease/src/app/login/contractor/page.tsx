"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ContractorLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function handleSendOtp() {
    if (!phone.trim()) {
      setError("请输入手机号");
      return;
    }
    setError("");
    try {
      const res = await fetch("/api/auth/contractor/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      if (res.status === 429) {
        setError("请等待 60 秒后再试");
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "发送失败");
        return;
      }
      setOtpSent(true);
      setCountdown(60);
    } catch {
      setError("发送失败，请重试");
    }
  }

  async function handleLogin() {
    if (!otp.trim()) {
      setError("请输入验证码");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/contractor/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          code: otp.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "登录失败");
        return;
      }
      // Store session and redirect
      if (data.session?.access_token) {
        localStorage.setItem("contractor_token", data.session.access_token);
      }
      router.push(redirectTo || "/contractor/home");
    } catch {
      setError("登录失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] w-full max-w-md p-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">工人登录</h1>
        <p className="text-sm text-gray-500 mb-6">
          使用手机号和验证码登录
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            手机号
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (xxx) xxx-xxxx"
            className="w-full h-10 px-3 border border-[#E5E7EB] rounded-md text-sm
                       focus:outline-none focus:border-brand-600"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            验证码
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6 位验证码"
              maxLength={6}
              className="flex-1 h-10 px-3 border border-[#E5E7EB] rounded-md text-sm
                         focus:outline-none focus:border-brand-600"
            />
            <button
              onClick={handleSendOtp}
              disabled={countdown > 0 || !phone.trim()}
              className="h-10 px-4 border border-brand-600 text-brand-600 text-sm rounded-md
                         hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {countdown > 0 ? `${countdown}s` : "发送验证码"}
            </button>
          </div>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || !otp.trim() || !phone.trim()}
          className="w-full h-10 bg-brand-600 text-white text-sm font-medium rounded-md
                     hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "登录中..." : "登录"}
        </button>

        <p className="mt-4 text-center text-xs text-gray-400">
          还没有账号？联系您的物业经理获取注册码
        </p>
        <p className="mt-1 text-center text-xs text-gray-400">
          <a href="/register/contractor" className="text-brand-600 hover:underline">
            前往注册
          </a>
        </p>
      </div>
    </div>
  );
}

export default function ContractorLoginPage() {
  return (
    <Suspense>
      <ContractorLoginInner />
    </Suspense>
  );
}
