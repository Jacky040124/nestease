"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { getGradient } from "@/lib/property-utils";
import { StatusBadge } from "@/components/status-badge";
import { UrgencyBadge } from "@/components/urgency-badge";
import { WorkOrderStatus, Urgency } from "@/types";
import { api } from "@/lib/api";
import { generateRepairCode } from "@/lib/repair-code";

interface Property {
  id: string;
  address: string;
  unit: string | null;
  cover_image: string | null;
  photos: string[] | null;
  description: string | null;
  work_order_count?: number;
}

interface Owner {
  id: string;
  name: string;
  phone: string;
}

interface PropertyDetail {
  id: string;
  address: string;
  unit: string | null;
  description: string | null;
  cover_image: string | null;
  photos: string[] | null;
  repair_code: string;
  notes: string | null;
}

interface WorkOrder {
  id: string;
  status: WorkOrderStatus;
  description: string;
  urgency: Urgency;
  created_at: string;
}

export default function PropertiesPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [pmId, setPmId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const fetchProperties = useCallback(async (pmIdOverride?: string) => {
    const id = pmIdOverride || pmId;
    if (!id) return;
    const { data } = await supabaseBrowser
      .from("property")
      .select("id, address, unit, cover_image, photos, description, work_order(count)")
      .eq("pm_id", id)
      .order("address");

    if (data) {
      const mapped = data.map((p: Record<string, unknown>) => ({
        ...p,
        work_order_count: Array.isArray(p.work_order) ? (p.work_order[0] as Record<string, number>)?.count ?? 0 : 0,
      })) as Property[];
      setProperties(mapped);
    }
  }, [pmId]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: pm } = await supabaseBrowser.from("pm").select("id").eq("auth_id", user.id).single();
      if (!pm) { setLoading(false); return; }
      setPmId(pm.id);
      await fetchProperties(pm.id);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-gray-50">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-16 bg-gray-100 rounded animate-pulse mt-2" />
            </div>
            <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">物业管理</h1>
            <p className="text-sm text-gray-500 mt-1">共 {properties.length} 个物业</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            添加物业
          </button>
        </div>

        {/* Add property modal */}
        {showForm && pmId && (
          <AddPropertyModal
            pmId={pmId}
            onClose={() => setShowForm(false)}
            onCreated={() => { setShowForm(false); fetchProperties(); }}
          />
        )}

        {/* Property detail modal */}
        {selectedPropertyId && (
          <PropertyDetailModal
            propertyId={selectedPropertyId}
            onClose={() => setSelectedPropertyId(null)}
          />
        )}

        {/* Card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {properties.map((property) => (
            <button
              key={property.id}
              onClick={() => setSelectedPropertyId(property.id)}
              className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden transition-shadow group cursor-pointer hover:shadow-md text-left"
            >
              {/* Cover image */}
              <div className="relative h-36 overflow-hidden bg-gray-100">
                {property.cover_image ? (
                  <img
                    src={property.cover_image}
                    alt={property.address}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className={`w-full h-full ${getGradient(property.address)}`} />
                )}
                {property.unit && (
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded text-xs font-medium text-gray-700">
                    Unit {property.unit}
                  </div>
                )}
              </div>

              {/* Card body */}
              <div className="p-3.5">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{property.address}</h3>
                {property.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                    {property.description}
                  </p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-[#F3F4F6]">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                    </svg>
                    <span>{property.work_order_count ?? 0} 工单</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {properties.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-gray-400">还没有物业</p>
            <p className="text-xs text-gray-300 mt-1">点击上方"添加物业"开始</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Property Detail Modal ─────────────────────────────────────────────

function PropertyDetailModal({
  propertyId,
  onClose,
}: {
  propertyId: string;
  onClose: () => void;
}) {
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroIdx, setHeroIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [visible, setVisible] = useState(false);

  // Trigger entrance animation
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Fetch property details and work orders
  useEffect(() => {
    (async () => {
      const { data: prop } = await supabaseBrowser
        .from("property")
        .select("id, address, unit, description, cover_image, photos, repair_code, notes")
        .eq("id", propertyId)
        .single();

      if (prop) {
        setProperty(prop as PropertyDetail);
        setNotes(prop.notes || "");

        const { data: wos } = await supabaseBrowser
          .from("work_order")
          .select("id, status, description, urgency, created_at")
          .eq("property_id", propertyId)
          .order("created_at", { ascending: false });
        if (wos) setWorkOrders(wos as WorkOrder[]);
      }
      setLoading(false);
    })();
  }, [propertyId]);

  const handleClose = () => {
    handleNotesSave();
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const handleNotesSave = async () => {
    if (!property) return;
    setNotesSaving(true);
    await supabaseBrowser
      .from("property")
      .update({ notes: notes || null })
      .eq("id", property.id);
    setNotesSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${visible ? "opacity-30" : "opacity-0"}`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`relative w-full max-w-[560px] bg-white shadow-xl h-full overflow-y-auto transition-transform duration-300 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors z-10"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : !property ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-sm text-gray-500">物业不存在</p>
            <button onClick={handleClose} className="text-xs text-brand-600 hover:text-brand-700">关闭</button>
          </div>
        ) : (
          <>
            {/* Hero photos */}
            {(() => {
              const photos = property.photos?.length ? property.photos : property.cover_image ? [property.cover_image] : [];
              const currentPhoto = photos[heroIdx];
              return (
                <>
                  <div className="relative aspect-video overflow-hidden bg-gray-200">
                    {currentPhoto ? (
                      <img src={currentPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className={`absolute inset-0 ${getGradient(property.address)}`} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    {photos.length > 1 && (
                      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-xs text-white">
                        {heroIdx + 1} / {photos.length}
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h1 className="text-xl font-semibold text-white">{property.address}</h1>
                      {property.unit && (
                        <span className="inline-block mt-1 bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded text-xs font-medium text-white/90">
                          Unit {property.unit}
                        </span>
                      )}
                    </div>
                  </div>
                  {photos.length > 1 && (
                    <div className="flex gap-1.5 px-6 py-3 bg-white border-b border-gray-100 overflow-x-auto">
                      {photos.map((src, i) => (
                        <button
                          key={i}
                          onClick={() => setHeroIdx(i)}
                          className={`shrink-0 w-14 h-10 rounded overflow-hidden border-2 transition-colors ${
                            i === heroIdx ? "border-brand-600" : "border-transparent hover:border-gray-300"
                          }`}
                        >
                          <img src={src} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            <div className="p-6">
              {/* Description */}
              {property.description && (
                <div className="mb-6">
                  <p className="text-sm text-gray-600">{property.description}</p>
                </div>
              )}

              {/* Repair code */}
              <div className="mb-6 bg-gray-50 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">报修码</h2>
                <div className="flex items-center gap-3">
                  <code className="text-lg font-mono font-bold text-brand-600 tracking-widest bg-white px-4 py-2 rounded-md border border-gray-200">
                    {property.repair_code}
                  </code>
                  <button
                    onClick={() => {
                      const repairUrl = `${window.location.origin}/repair?code=${property.repair_code}`;
                      navigator.clipboard.writeText(repairUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="shrink-0 px-3 py-2 text-xs font-medium text-brand-600 bg-brand-50 rounded hover:bg-brand-100 transition-colors"
                  >
                    {copied ? "已复制" : "复制报修链接"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">租户输入此报修码或通过链接直接提交报修</p>
              </div>

              {/* Notes */}
              <div className="mb-6 bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-gray-900">备注</h2>
                  {notesSaving && <span className="text-xs text-gray-400">保存中...</span>}
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={handleNotesSave}
                  placeholder="添加物业备注..."
                  rows={4}
                  className="w-full text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>

              {/* Work orders */}
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-gray-900">工单 ({workOrders.length})</h2>
              </div>

              {workOrders.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-400">该物业暂无工单</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {workOrders.map((wo) => (
                    <div
                      key={wo.id}
                      className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100/80 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <StatusBadge status={wo.status} />
                        <UrgencyBadge urgency={wo.urgency} />
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{wo.description}</p>
                      <p className="text-xs text-gray-400 mt-2">{new Date(wo.created_at).toLocaleDateString("zh-CN")}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Add Property Modal ─────────────────────────────────────────────

function AddPropertyModal({
  pmId,
  onClose,
  onCreated,
}: {
  pmId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [address, setAddress] = useState("");
  const [unit, setUnit] = useState("");
  const [description, setDescription] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [existingOwners, setExistingOwners] = useState<Owner[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [ownerMode, setOwnerMode] = useState<"existing" | "new">("existing");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabaseBrowser
      .from("owner")
      .select("id, name, phone, property!inner(pm_id)")
      .eq("property.pm_id", pmId)
      .order("name")
      .then(({ data }) => {
        if (data && data.length > 0) {
          const owners = data.map((o: Record<string, unknown>) => ({
            id: o.id as string,
            name: o.name as string,
            phone: o.phone as string,
          }));
          // Deduplicate owners (one owner may have multiple properties)
          const unique = [...new Map(owners.map((o) => [o.id, o])).values()];
          setExistingOwners(unique);
          setSelectedOwnerId(unique[0].id);
        } else {
          setOwnerMode("new");
        }
      });
  }, [pmId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!address.trim()) { setError("请填写地址"); return; }
    if (ownerMode === "existing" && !selectedOwnerId) { setError("请选择业主"); return; }

    setSubmitting(true);
    try {
      let ownerId = selectedOwnerId;

      if (ownerMode === "new") {
        if (!ownerName.trim() || !ownerPhone.trim()) {
          setError("请填写业主姓名和电话");
          setSubmitting(false);
          return;
        }
        const { data: newOwner, error: ownerErr } = await supabaseBrowser
          .from("owner")
          .insert({ name: ownerName.trim(), phone: ownerPhone.trim(), email: ownerEmail.trim() || null })
          .select()
          .single();
        if (ownerErr || !newOwner) { setError("创建业主失败，请重试"); setSubmitting(false); return; }
        ownerId = newOwner.id;
      }

      // Upload images if provided
      const photoUrls: string[] = [];
      const uploadedPaths: string[] = [];
      for (const file of imageFiles) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${pmId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabaseBrowser.storage
          .from("property-images")
          .upload(path, file, { contentType: file.type });
        if (uploadErr) {
          // Clean up already-uploaded files
          if (uploadedPaths.length > 0) {
            await supabaseBrowser.storage.from("property-images").remove(uploadedPaths);
          }
          setError("上传图片失败，请重试");
          setSubmitting(false);
          return;
        }
        uploadedPaths.push(path);
        const { data: urlData } = supabaseBrowser.storage.from("property-images").getPublicUrl(path);
        photoUrls.push(urlData.publicUrl);
      }

      const { data: newProp, error: propErr } = await supabaseBrowser
        .from("property")
        .insert({
          address: address.trim(),
          unit: unit.trim() || null,
          description: description.trim() || null,
          cover_image: photoUrls[0] || null,
          photos: photoUrls,
          owner_id: ownerId,
          pm_id: pmId,
          repair_code: generateRepairCode(),
        })
        .select("id")
        .single();

      if (propErr || !newProp) {
        // Clean up uploaded files if property creation failed
        if (uploadedPaths.length > 0) {
          await supabaseBrowser.storage.from("property-images").remove(uploadedPaths);
        }
        setError("创建物业失败，请重试");
        setSubmitting(false);
        return;
      }

      onCreated();
    } catch {
      setError("操作失败，请重试");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">添加物业</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Property info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">地址 *</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="例: 6060 No. 3 Rd, Richmond"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">单元号</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="例: 1208"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例: 高层公寓，两室一厅"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Photo upload — multi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              物业照片{imagePreviews.length > 0 && ` (${imagePreviews.length})`}
            </label>
            <div className="flex flex-wrap gap-2">
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative w-20 h-20">
                  <img src={src} alt={`预览 ${i + 1}`} className="w-full h-full object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(src);
                      setImageFiles((prev) => prev.filter((_, j) => j !== i));
                      setImagePreviews((prev) => prev.filter((_, j) => j !== i));
                    }}
                    className="absolute -top-1.5 -right-1.5 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] hover:bg-black/80"
                  >
                    &times;
                  </button>
                </div>
              ))}
              {imageFiles.length < 10 && (
                <label className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-400 transition-colors">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 0) return;
                      const MAX_FILES = 10;
                      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
                      const remaining = MAX_FILES - imageFiles.length;
                      if (remaining <= 0) { setError("最多上传 10 张照片"); e.target.value = ""; return; }
                      const accepted = files.slice(0, remaining);
                      const oversized = accepted.filter((f) => f.size > MAX_SIZE);
                      if (oversized.length > 0) { setError(`单张照片不超过 5MB，${oversized.map((f) => f.name).join("、")} 过大`); e.target.value = ""; return; }
                      setError("");
                      setImageFiles((prev) => [...prev, ...accepted]);
                      setImagePreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Owner section */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-medium text-gray-700">业主信息</span>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setOwnerMode("existing")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    ownerMode === "existing" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                  }`}
                >
                  已有业主
                </button>
                <button
                  type="button"
                  onClick={() => setOwnerMode("new")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    ownerMode === "new" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                  }`}
                >
                  新增业主
                </button>
              </div>
            </div>

            {ownerMode === "existing" ? (
              <select
                value={selectedOwnerId}
                onChange={(e) => setSelectedOwnerId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                {existingOwners.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.phone})</option>
                ))}
              </select>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">姓名 *</label>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="例: 周建华"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">电话 *</label>
                    <input
                      type="text"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      placeholder="例: +16041234567"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">邮箱</label>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="可选"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "创建中..." : "创建物业"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
