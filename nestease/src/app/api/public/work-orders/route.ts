import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { WorkOrderStatus, Urgency, Category } from "@/types";
import { getNotificationMessage } from "@/lib/notification-messages";
import { dispatchNotification } from "@/lib/send-notification";
import { generateToken } from "@/lib/token";

// POST /api/public/work-orders — Tenant creates work order (no auth required)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { property_id, name, phone, category, description, photos, urgency } = body;

  if (!property_id || !category || !description) {
    return NextResponse.json(
      { error: "Missing required fields: property_id, category, description" },
      { status: 400 }
    );
  }

  if (!Object.values(Category).includes(category)) {
    return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 });
  }
  if (urgency && !Object.values(Urgency).includes(urgency)) {
    return NextResponse.json({ error: `Invalid urgency: ${urgency}` }, { status: 400 });
  }

  // Fetch property
  const { data: property, error: propErr } = await supabaseAdmin
    .from("property")
    .select("address, unit, owner_id, pm_id")
    .eq("id", property_id)
    .single();

  if (propErr || !property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // Find or create tenant
  if (!name || !phone) {
    return NextResponse.json({ error: "请填写姓名和电话" }, { status: 422 });
  }

  // Try to find existing tenant by phone + property
  const { data: existingTenant } = await supabaseAdmin
    .from("tenant")
    .select("id, name, phone")
    .eq("property_id", property_id)
    .eq("phone", phone)
    .maybeSingle();

  let tenantId: string;
  if (existingTenant) {
    tenantId = existingTenant.id;
    // Update name if changed
    if (name && name !== existingTenant.name) {
      await supabaseAdmin.from("tenant").update({ name }).eq("id", tenantId);
    }
  } else {
    const { data: newTenant, error: tenantErr } = await supabaseAdmin
      .from("tenant")
      .insert({ name, phone, property_id })
      .select("id")
      .single();
    if (tenantErr || !newTenant) {
      return NextResponse.json({ error: "创建租户失败" }, { status: 500 });
    }
    tenantId = newTenant.id;
  }

  const { data, error } = await supabaseAdmin
    .from("work_order")
    .insert({
      status: WorkOrderStatus.PendingAssignment,
      property_id,
      property_address: property.address,
      unit: property.unit || null,
      tenant_id: tenantId,
      tenant_name: name,
      tenant_phone: phone,
      category,
      description,
      photos: photos || [],
      urgency: urgency || Urgency.Normal,
      owner_id: property.owner_id,
      pm_id: property.pm_id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabaseAdmin.from("work_order_status_history").insert({
    work_order_id: data.id,
    from_status: null,
    to_status: WorkOrderStatus.PendingAssignment,
    action: "tenant_submit",
    actor_id: tenantId,
    actor_role: "tenant",
  });

  const msg = getNotificationMessage("new_work_order", {
    workOrderId: data.id,
    address: property.address,
    description,
  });
  const { data: notifRow, error: notifyError } = await supabaseAdmin.from("notification").insert({
    work_order_id: data.id,
    target_role: "pm",
    target_id: property.pm_id,
    channel: "sms",
    event: "new_work_order",
    message: msg,
  }).select("id").single();
  if (notifyError) {
    console.error(`Failed to create notification (new_work_order → pm):`, notifyError.message);
  }
  await dispatchNotification({
    notificationId: notifRow?.id,
    workOrderId: data.id,
    targetRole: "pm",
    targetId: property.pm_id,
    event: "new_work_order",
    message: msg,
  }).catch((err) => console.error("[notify] dispatch failed:", err));

  // Generate a signed token so the tenant can track status
  const statusToken = generateToken({
    workOrderId: data.id,
    role: "tenant",
    actorId: tenantId,
  });

  return NextResponse.json({ data, statusToken }, { status: 201 });
}
