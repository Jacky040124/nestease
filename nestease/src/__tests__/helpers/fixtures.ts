/** Test data factories for E2E tests */

export const PM = {
  id: "pm-001",
  auth_id: "auth-pm-001",
  name: "Jacky",
  phone: "+15555550001",
  email: "pm@test.com",
  auto_approval_enabled: true,
  auto_approval_threshold: 300,
  follow_up_wait_days: 7,
  notification_channel: "sms",
};

export const OWNER = {
  id: "owner-001",
  name: "王先生",
  phone: "+16041234567",
  email: "owner@test.com",
};

export const PROPERTY = {
  id: "prop-001",
  address: "6060 No. 3 Rd, Richmond",
  unit: "201",
  owner_id: OWNER.id,
  pm_id: PM.id,
};

export const TENANT = {
  id: "tenant-001",
  name: "张三",
  phone: "+17789991234",
  email: "tenant@test.com",
  property_id: PROPERTY.id,
};

export const CONTRACTOR = {
  id: "contractor-001",
  name: "刘师傅",
  phone: "+16049981234",
  email: "liu@test.com",
  specialties: ["plumbing"],
  pm_id: PM.id,
};

export const CONTRACTOR_2 = {
  id: "contractor-002",
  name: "黄师傅",
  phone: "+17789975678",
  email: "huang@test.com",
  specialties: ["electrical"],
  pm_id: PM.id,
};

export function makeWorkOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    status: "pending_assignment",
    property_id: PROPERTY.id,
    property_address: PROPERTY.address,
    unit: PROPERTY.unit,
    tenant_id: TENANT.id,
    tenant_name: TENANT.name,
    tenant_phone: TENANT.phone,
    category: "plumbing",
    description: "水管漏水",
    photos: [],
    urgency: "normal",
    owner_id: OWNER.id,
    pm_id: PM.id,
    contractor_id: null,
    quote_id: null,
    completion_report_id: null,
    assigned_at: null,
    completed_at: null,
    approval_required: false,
    approval_status: null,
    approved_by: null,
    approved_at: null,
    follow_up_status: null,
    follow_up_deadline: null,
    follow_up_sent_at: null,
    held_from_status: null,
    parent_work_order_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
