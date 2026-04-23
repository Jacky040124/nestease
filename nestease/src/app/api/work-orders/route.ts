import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { withAuth } from "@/lib/with-auth";
import { WorkOrderStatus, Urgency, Category } from "@/types";
import { getNotificationMessage } from "@/lib/notification-messages";

// GET /api/work-orders — List work orders (with filters)
export const GET = withAuth(async (_user, request) => {

  const { searchParams } = new URL(request.url);
  const pm_id = searchParams.get("pm_id");
  const status = searchParams.get("status");
  const property_id = searchParams.get("property_id");
  const contractor_id = searchParams.get("contractor_id");
  const urgency = searchParams.get("urgency");

  if (!pm_id) {
    return NextResponse.json({ error: "pm_id is required" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("work_order")
    .select("*")
    .eq("pm_id", pm_id)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (property_id) query = query.eq("property_id", property_id);
  if (contractor_id) query = query.eq("contractor_id", contractor_id);
  if (urgency) query = query.eq("urgency", urgency);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
});

// POST /api/work-orders — Create a new work order (tenant submits repair request)
export const POST = withAuth(async (_user, request) => {

  const body = await request.json();

  const {
    property_id,
    tenant_id,
    category,
    description,
    photos,
    urgency,
  } = body;

  // Validate required fields
  if (!property_id || !tenant_id || !category || !description) {
    return NextResponse.json(
      { error: "Missing required fields: property_id, tenant_id, category, description" },
      { status: 400 }
    );
  }

  // Validate enums
  if (!Object.values(Category).includes(category)) {
    return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 });
  }
  if (urgency && !Object.values(Urgency).includes(urgency)) {
    return NextResponse.json({ error: `Invalid urgency: ${urgency}` }, { status: 400 });
  }

  // Auto-fill property and tenant info from DB
  const [propertyRes, tenantRes] = await Promise.all([
    supabaseAdmin
      .from("property")
      .select("address, unit, owner_id, pm_id")
      .eq("id", property_id)
      .single(),
    supabaseAdmin
      .from("tenant")
      .select("name, phone")
      .eq("id", tenant_id)
      .single(),
  ]);

  if (propertyRes.error || !propertyRes.data) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  if (tenantRes.error || !tenantRes.data) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const property = propertyRes.data;
  const tenant = tenantRes.data;

  const { data, error } = await supabaseAdmin
    .from("work_order")
    .insert({
      status: WorkOrderStatus.PendingAssignment,
      property_id,
      property_address: property.address,
      unit: property.unit || null,
      tenant_id,
      tenant_name: tenant.name,
      tenant_phone: tenant.phone,
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

  // Log status history
  await supabaseAdmin.from("work_order_status_history").insert({
    work_order_id: data.id,
    from_status: null,
    to_status: WorkOrderStatus.PendingAssignment,
    action: "tenant_submit",
    actor_id: tenant_id,
    actor_role: "tenant",
  });

  // Create notification for PM
  const { error: notifyError } = await supabaseAdmin.from("notification").insert({
    work_order_id: data.id,
    target_role: "pm",
    target_id: property.pm_id,
    channel: "sms",
    event: "new_work_order",
    message: getNotificationMessage("new_work_order", {
      workOrderId: data.id,
      address: property.address,
      description,
    }),
  });
  if (notifyError) {
    console.error(`Failed to send notification (new_work_order → pm):`, notifyError.message);
  }

  return NextResponse.json({ data }, { status: 201 });
});
