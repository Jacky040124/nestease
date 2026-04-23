"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { NotificationChannel } from "@/types";
import Link from "next/link";

interface PMSettingsData {
  auto_approval_enabled: boolean;
  auto_approval_threshold: number;
  follow_up_wait_days: number;
  notification_channel: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [pmId, setPmId] = useState<string | null>(null);
  const [settings, setSettings] = useState<PMSettingsData>({
    auto_approval_enabled: false,
    auto_approval_threshold: 300,
    follow_up_wait_days: 10,
    notification_channel: "sms",
  });
  const [pmCode, setPmCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Look up pm.id from auth user id
  useEffect(() => {
    if (!user) return;
    supabaseBrowser.from("pm").select("id").eq("auth_id", user.id).single()
      .then(({ data }) => { if (data) setPmId(data.id); });
  }, [user]);

  useEffect(() => {
    if (!pmId) return;
    // Load PM settings
    supabaseBrowser.from("pm").select("auto_approval_enabled, auto_approval_threshold, follow_up_wait_days, notification_channel, pm_code")
      .eq("id", pmId).single()
      .then(({ data }) => {
        if (data) {
          const { pm_code, ...rest } = data;
          setSettings(rest as PMSettingsData);
          if (pm_code) setPmCode(pm_code);
        }
      });
  }, [pmId]);

  const handleSave = async () => {
    if (!pmId) return;
    setSaving(true);
    await supabaseBrowser.from("pm").update(settings).eq("id", pmId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-xl font-semibold text-gray-900">设置</h1>

        {/* PM Code */}
        {pmCode && (
          <section className="border border-[#E5E7EB] rounded-lg p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">PM Code</h2>
            <p className="text-xs text-gray-500">你的专属邀请码，工人通过此码注册后自动关联到你</p>
            <div className="flex items-center gap-3">
              <span className="text-lg font-mono font-bold text-brand-600 tracking-widest">{pmCode}</span>
            </div>
          </section>
        )}

        {/* Approval settings */}
        <section className="border border-[#E5E7EB] rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">审批设置</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-900">自动审批</div>
              <div className="text-xs text-gray-500">低于阈值的报价自动通过</div>
            </div>
            <button
              onClick={() => setSettings({ ...settings, auto_approval_enabled: !settings.auto_approval_enabled })}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                settings.auto_approval_enabled ? "bg-brand-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  settings.auto_approval_enabled ? "left-[18px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
          {settings.auto_approval_enabled && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">自动审批阈值</label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">$</span>
                <input
                  type="number"
                  value={settings.auto_approval_threshold}
                  onChange={(e) => setSettings({ ...settings, auto_approval_threshold: parseInt(e.target.value) || 0 })}
                  className="w-32 h-9 px-3 border border-[#E5E7EB] rounded-md text-sm font-mono
                             focus:outline-none focus:border-brand-600"
                  min={0}
                />
              </div>
            </div>
          )}
        </section>

        {/* Follow-up settings */}
        <section className="border border-[#E5E7EB] rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Follow-up 设置</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">等待天数</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={settings.follow_up_wait_days}
                onChange={(e) => setSettings({ ...settings, follow_up_wait_days: parseInt(e.target.value) || 1 })}
                className="w-20 h-9 px-3 border border-[#E5E7EB] rounded-md text-sm font-mono text-center
                           focus:outline-none focus:border-brand-600"
                min={1}
              />
              <span className="text-sm text-gray-500">天后租户无回复，自动标记完成</span>
            </div>
          </div>
        </section>

        {/* Notification settings */}
        <section className="border border-[#E5E7EB] rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">通知设置</h2>
          <div className="flex gap-4">
            {[
              { value: NotificationChannel.SMS, label: "短信" },
              { value: NotificationChannel.Email, label: "邮件" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="channel"
                  value={opt.value}
                  checked={settings.notification_channel === opt.value}
                  onChange={() => setSettings({ ...settings, notification_channel: opt.value })}
                  className="accent-brand-600"
                />
                {opt.label}
              </label>
            ))}
            <label className="flex items-center gap-1.5 text-sm text-gray-400 cursor-not-allowed">
              <input type="radio" name="channel" disabled className="accent-brand-600" />
              微信（即将上线）
            </label>
          </div>
        </section>

        {/* Contractor management — dedicated page */}
        <section className="border border-[#E5E7EB] rounded-lg p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">工人管理</h2>
          <p className="text-xs text-gray-500">
            工人管理已迁移到独立页面，支持评分、备注、指标分析等功能。
          </p>
          <Link
            href="/dashboard/contractors"
            className="inline-block text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            前往工人管理 &rarr;
          </Link>
        </section>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 h-9 bg-brand-600 text-white text-sm font-medium rounded-md
                       hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存设置"}
          </button>
          {saved && <span className="text-sm text-success">已保存</span>}
        </div>
      </div>
    </div>
  );
}
