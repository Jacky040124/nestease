"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CATEGORY_LABELS } from "@/lib/labels";

const SPECIALTIES = ["plumbing", "electrical", "hvac", "locks", "other"] as const;

function ContractorRegisterInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const redirectTo = searchParams.get("redirect");
  const [pmCode, setPmCode] = useState(searchParams.get("code") || "");
  const [pmName, setPmName] = useState<string | null>(null);
  const [pmCodeValid, setPmCodeValid] = useState<boolean | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);

  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-verify PM code from URL
  useEffect(() => {
    if (searchParams.get("code")) {
      verifyPmCode(searchParams.get("code")!);
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function verifyPmCode(code: string) {
    if (!code.trim()) return;
    setVerifyingCode(true);
    setError("");
    try {
      const res = await fetch("/api/auth/contractor/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setPmName(data.pm_name);
        setPmCodeValid(true);
      } else {
        setPmName(null);
        setPmCodeValid(false);
      }
    } catch {
      setError("验证失败，请重试");
    } finally {
      setVerifyingCode(false);
    }
  }

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

  async function handleRegister() {
    if (!name.trim()) {
      setError("请输入姓名");
      return;
    }
    if (specialties.length === 0) {
      setError("请至少选择一个专长");
      return;
    }
    if (!otp.trim()) {
      setError("请输入验证码");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/contractor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pm_code: pmCode.trim(),
          name: name.trim(),
          phone: phone.trim(),
          specialties,
          otp: otp.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "注册失败");
        return;
      }
      // Store session and redirect
      if (data.session?.access_token) {
        localStorage.setItem("contractor_token", data.session.access_token);
      }
      router.push(redirectTo || "/contractor/home");
    } catch {
      setError("注册失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  function toggleSpecialty(s: string) {
    setSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] w-full max-w-md p-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">工人注册</h1>
        <p className="text-sm text-gray-500 mb-6">
          通过物业经理的注册码加入平台
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Step 1: PM Code */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            注册码
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={pmCode}
              onChange={(e) => {
                setPmCode(e.target.value.toUpperCase());
                setPmCodeValid(null);
                setPmName(null);
              }}
              placeholder="输入 6 位注册码"
              maxLength={6}
              className="flex-1 h-10 px-3 border border-[#E5E7EB] rounded-md text-sm uppercase
                         focus:outline-none focus:border-brand-600 focus:shadow-[var(--shadow-focus)]"
            />
            <button
              onClick={() => verifyPmCode(pmCode)}
              disabled={pmCode.length < 6 || verifyingCode}
              className="h-10 px-4 bg-brand-600 text-white text-sm rounded-md
                         hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifyingCode ? "验证中..." : "验证"}
            </button>
          </div>
          {pmCodeValid === true && (
            <p className="mt-1 text-sm text-green-600">
              物业经理：{pmName}
            </p>
          )}
          {pmCodeValid === false && (
            <p className="mt-1 text-sm text-red-500">无效的注册码</p>
          )}
        </div>

        {/* Step 2: Info (only show after PM code verified) */}
        {pmCodeValid && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                姓名
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="您的姓名"
                className="w-full h-10 px-3 border border-[#E5E7EB] rounded-md text-sm
                           focus:outline-none focus:border-brand-600"
              />
            </div>

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

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                专长（至少选一个）
              </label>
              <div className="flex flex-wrap gap-2">
                {SPECIALTIES.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSpecialty(s)}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                      specialties.includes(s)
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white text-gray-600 border-[#E5E7EB] hover:border-brand-300"
                    }`}
                  >
                    {CATEGORY_LABELS[s] ?? s}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: OTP */}
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
              onClick={handleRegister}
              disabled={loading || !otp.trim() || !name.trim() || specialties.length === 0}
              className="w-full h-10 bg-brand-600 text-white text-sm font-medium rounded-md
                         hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "注册中..." : "注册"}
            </button>
          </>
        )}

        <p className="mt-4 text-center text-xs text-gray-400">
          已有账号？
          <a href="/login/contractor" className="text-brand-600 hover:underline ml-1">
            登录
          </a>
        </p>
      </div>
    </div>
  );
}

export default function ContractorRegisterPage() {
  return (
    <Suspense>
      <ContractorRegisterInner />
    </Suspense>
  );
}
