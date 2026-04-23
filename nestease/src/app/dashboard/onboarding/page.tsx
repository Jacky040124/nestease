"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Tone = "professional" | "friendly" | "direct";

const TONE_OPTIONS: { key: Tone; label: string; description: string; preview: string }[] = [
  {
    key: "professional",
    label: "专业",
    description: "正式、礼貌、完整句子",
    preview: "张师傅您好，工单 #1234 已批准，请确认您的可用时间。谢谢。",
  },
  {
    key: "friendly",
    label: "亲切",
    description: "口语化、自然、带温度",
    preview: "张师傅，报价批准啦！方便的话跟我说一下什么时候能开工？",
  },
  {
    key: "direct",
    label: "简洁",
    description: "短句、只说关键信息",
    preview: "工单1234已批准，请回复可开工时间。",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [agentName, setAgentName] = useState("小栖");
  const [tone, setTone] = useState<Tone>("friendly");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAgentConfig()
      .then((res) => {
        const data = res.data;
        if (data.agent_name) setAgentName(data.agent_name);
        if (data.agent_tone) setTone(data.agent_tone as Tone);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleFinish = async () => {
    setSaving(true);
    try {
      await api.updateAgentConfig({
        agent_name: agentName,
        agent_avatar: "default",
        agent_tone: tone,
      });
      router.push("/dashboard");
    } catch {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
      <div className="w-full max-w-2xl">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-gray-900" : "bg-gray-200"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Step 1: Name */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold mb-2">给你的助手起个名字</h1>
            <p className="text-sm text-gray-500 mb-8">
              这个名字会出现在师傅收到的短信里，让师傅知道是谁在跟他沟通。
            </p>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="小栖"
              maxLength={50}
              className="w-full px-4 py-3 text-lg border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
            />
            <p className="text-xs text-gray-400 mt-2">
              示例短信："{agentName || '小栖'}提醒您，工单 #1234 已批准。"
            </p>
            <div className="flex justify-end mt-8">
              <button
                onClick={() => setStep(2)}
                disabled={!agentName.trim()}
                className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                下一步
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Tone */}
        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold mb-2">选择沟通风格</h1>
            <p className="text-sm text-gray-500 mb-6">
              这决定了助手跟师傅沟通时的语气和措辞。
            </p>
            <div className="space-y-3">
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setTone(opt.key)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    tone === opt.key
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{opt.label}</span>
                    <span className="text-xs text-gray-400">{opt.description}</span>
                  </div>
                  <div className="bg-white rounded px-3 py-2 mt-2 border border-gray-100">
                    <p className="text-sm text-gray-600 italic">"{opt.preview}"</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white text-sm font-medium shrink-0">
                  {agentName.slice(0, 1)}
                </div>
                <div>
                  <div className="font-medium text-sm">{agentName}</div>
                  <div className="text-xs text-gray-400">
                    {TONE_OPTIONS.find((o) => o.key === tone)?.description}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                上一步
              </button>
              <button
                onClick={handleFinish}
                disabled={saving}
                className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                {saving ? "保存中..." : "启动助手"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
