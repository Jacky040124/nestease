"use client";

import { Suspense, useState, FormEvent, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { MobileLayout } from "@/components/mobile-layout";
import { Category, Urgency } from "@/types";

const CATEGORY_OPTIONS = [
  { value: Category.Plumbing, label: "水管" },
  { value: Category.Electrical, label: "电路" },
  { value: Category.HVAC, label: "暖通" },
  { value: Category.Locks, label: "门锁" },
  { value: Category.Other, label: "其他" },
];

interface PropertyInfo {
  id: string;
  address: string;
  unit: string | null;
  pm_id: string;
}

function RepairPage() {
  const searchParams = useSearchParams();
  const codeParam = searchParams.get("code")?.trim().toUpperCase() ?? "";

  // Step 1: Code input
  const [code, setCode] = useState(codeParam);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [property, setProperty] = useState<PropertyInfo | null>(null);

  // Step 2: Repair form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<Urgency>(Urgency.Normal);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [workOrderId, setWorkOrderId] = useState("");
  const [statusToken, setStatusToken] = useState("");
  const [error, setError] = useState("");

  // Auto-lookup if code param provided
  useEffect(() => {
    if (codeParam) lookupCode(codeParam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lookupCode = async (c: string) => {
    const trimmed = c.trim().toUpperCase();
    if (!trimmed) return;
    setCodeLoading(true);
    setCodeError("");
    try {
      const res = await fetch(`/api/public/property-by-code?code=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        setCodeError("未找到对应的物业，请检查报修码");
        setCodeLoading(false);
        return;
      }
      const data = await res.json();
      setProperty(data as PropertyInfo);
    } catch {
      setCodeError("查询失败，请重试");
    } finally {
      setCodeLoading(false);
    }
  };

  const handleCodeSubmit = (e: FormEvent) => {
    e.preventDefault();
    lookupCode(code);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          setPhotos((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!property) return;

    if (description.length < 10) {
      setError("问题描述至少 10 个字");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/public/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: property.id,
          name,
          phone,
          category,
          description,
          urgency,
          photos,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setWorkOrderId(json.data.id);
      setStatusToken(json.statusToken || "");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (submitted) {
    return (
      <MobileLayout title="报修已提交">
        <div className="text-center space-y-4">
          <div className="text-3xl">✅</div>
          <h2 className="text-md font-semibold text-gray-900">报修已提交!</h2>
          <p className="text-sm text-gray-500">
            工单号：<span className="font-mono">WO-{workOrderId.slice(0, 8)}</span>
          </p>
          <p className="text-sm text-gray-500">
            我们会尽快安排处理，您可以随时通过以下链接查看进度
          </p>
          <a
            href={`/status?id=${workOrderId}&token=${encodeURIComponent(statusToken)}`}
            className="inline-block px-4 h-9 leading-9 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700"
          >
            查看工单状态
          </a>
        </div>
      </MobileLayout>
    );
  }

  // Step 1: Code entry (no property matched yet)
  if (!property) {
    return (
      <MobileLayout title="提交维修报修">
        <form onSubmit={handleCodeSubmit} className="space-y-4">
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500">请输入物业提供的报修码</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">报修码</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="w-full h-12 px-4 border border-[#E5E7EB] rounded-md text-lg font-mono tracking-widest text-center uppercase
                         focus:outline-none focus:border-brand-600 focus:shadow-[var(--shadow-focus)]
                         placeholder:text-gray-300 placeholder:tracking-normal placeholder:text-base placeholder:font-normal"
              placeholder="例: A3K7P2"
              autoFocus
            />
          </div>

          {codeError && <p className="text-sm text-error text-center">{codeError}</p>}

          <button
            type="submit"
            disabled={codeLoading || !code.trim()}
            className="w-full h-10 bg-brand-600 text-white text-sm font-medium rounded-md
                       hover:bg-brand-700 active:bg-brand-800
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {codeLoading ? "查询中..." : "下一步"}
          </button>
        </form>
      </MobileLayout>
    );
  }

  // Step 2: Repair form (property matched)
  return (
    <MobileLayout title="提交维修报修">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Property address (readonly) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">物业地址</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={property.unit ? `${property.address}, ${property.unit}` : property.address}
              readOnly
              className="flex-1 h-9 px-3 border border-[#E5E7EB] rounded-md text-sm bg-[#E9ECEF] text-gray-500"
            />
            <button
              type="button"
              onClick={() => { setProperty(null); setCode(""); }}
              className="text-xs text-brand-600 hover:text-brand-700 shrink-0"
            >
              更换
            </button>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">您的姓名 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={20}
            className="w-full h-9 px-3 border border-[#E5E7EB] rounded-md text-sm
                       focus:outline-none focus:border-brand-600 focus:shadow-[var(--shadow-focus)]
                       placeholder:text-gray-400"
            placeholder="请输入姓名"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">联系电话 *</label>
          <input
            type="text"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="w-full h-9 px-3 border border-[#E5E7EB] rounded-md text-sm
                       focus:outline-none focus:border-brand-600 focus:shadow-[var(--shadow-focus)]
                       placeholder:text-gray-400"
            placeholder="请输入电话号码"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">问题类别 *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="w-full h-9 px-3 border border-[#E5E7EB] rounded-md text-sm
                       focus:outline-none focus:border-brand-600 focus:shadow-[var(--shadow-focus)]
                       text-gray-700"
          >
            <option value="">请选择类别</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">问题描述 *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md text-sm resize-none
                       focus:outline-none focus:border-brand-600 focus:shadow-[var(--shadow-focus)]
                       placeholder:text-gray-400"
            placeholder="请详细描述问题（至少 10 个字）"
          />
        </div>

        {/* Photos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">上传照片</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {photos.map((photo, i) => (
              <div key={i} className="relative w-20 h-20">
                <img src={photo} alt={`照片${i + 1}`} className="w-full h-full object-cover rounded-md border border-gray-200" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                >
                  x
                </button>
              </div>
            ))}
            {photos.length < 5 && (
              <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 hover:bg-brand-50 transition-colors">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="text-xs text-gray-400 mt-0.5">拍照/上传</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <p className="text-xs text-gray-400">最多上传 5 张照片，手机可直接拍照</p>
        </div>

        {/* Urgency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">紧急程度</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="urgency"
                value={Urgency.Normal}
                checked={urgency === Urgency.Normal}
                onChange={() => setUrgency(Urgency.Normal)}
                className="accent-brand-600"
              />
              普通
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="urgency"
                value={Urgency.Urgent}
                checked={urgency === Urgency.Urgent}
                onChange={() => setUrgency(Urgency.Urgent)}
                className="accent-brand-600"
              />
              紧急（漏水、断电等）
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-10 bg-brand-600 text-white text-sm font-medium rounded-md
                     hover:bg-brand-700 active:bg-brand-800
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "提交中..." : "提交报修"}
        </button>
      </form>
    </MobileLayout>
  );
}

export default function RepairPageWrapper() {
  return (
    <Suspense>
      <RepairPage />
    </Suspense>
  );
}
