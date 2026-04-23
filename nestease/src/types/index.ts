// ============================================================
// NestEase — Work Order Management System
// Type definitions based on PRD v1
// ============================================================

// ── Work Order Status (状态机) ──────────────────────────────

export enum WorkOrderStatus {
  PendingAssignment = "pending_assignment",    // 待分配
  Assigned = "assigned",                       // 已派单
  Quoting = "quoting",                         // 报价中
  PendingApproval = "pending_approval",        // 待审批
  InProgress = "in_progress",                  // 施工中
  PendingVerification = "pending_verification", // 待验收
  Completed = "completed",                     // 已完成
  Cancelled = "cancelled",                     // 已取消
  OnHold = "on_hold",                          // 挂起
}

export enum Urgency {
  Normal = "normal",
  Urgent = "urgent",
}

export enum Category {
  Plumbing = "plumbing",       // 水管
  Electrical = "electrical",   // 电
  HVAC = "hvac",               // 暖通
  Locks = "locks",             // 门锁
  Other = "other",             // 其他
}

export enum ApprovalStatus {
  Pending = "pending",
  Approved = "approved",
  Rejected = "rejected",
}

export enum FollowUpStatus {
  PendingConfirmation = "pending_confirmation",
  Confirmed = "confirmed",
  HasIssue = "has_issue",
  AutoCompleted = "auto_completed",
}

export enum WorkType {
  Replacement = "replacement",
  Repair = "repair",
  Cleaning = "cleaning",
  Other = "other",
}

export enum NotificationChannel {
  SMS = "sms",
  WeChat = "wechat",
  Email = "email",
}

// ── User Roles ──────────────────────────────────────────────

export enum UserRole {
  PM = "pm",
  Tenant = "tenant",
  Contractor = "contractor",
  Owner = "owner",
}

// ── Data Models ─────────────────────────────────────────────

export interface Property {
  id: string;
  address: string;
  unit: string | null;
  owner_id: string;
  pm_id: string;
  created_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  property_id: string;
  created_at: string;
}

export interface Contractor {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  specialties: Category[];
  pm_id: string;
  auth_id: string | null;
  is_favorite: boolean;
  created_at: string;
}

export interface ContractorStats {
  total_completed: number;
  avg_rating: number | null;
  avg_quote: number | null;
  avg_completion_days: number | null;
  rework_rate: number;
  quote_variance: number | null;
}

export interface ContractorWithStats extends Contractor {
  stats: ContractorStats;
  recent_work_order: {
    id: string;
    property_address: string;
    category: Category;
    completed_at: string;
  } | null;
}

export interface ContractorRating {
  id: string;
  work_order_id: string;
  contractor_id: string;
  pm_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface ContractorNote {
  id: string;
  contractor_id: string;
  pm_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Owner {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  created_at: string;
}

export interface PM {
  id: string;
  name: string;
  phone: string;
  email: string;
  settings: PMSettings;
  created_at: string;
}

export interface PMSettings {
  auto_approval_enabled: boolean;
  auto_approval_threshold: number;  // in dollars, default 300
  follow_up_wait_days: number;      // default 10
  notification_channel: NotificationChannel;
}

export const DEFAULT_PM_SETTINGS: PMSettings = {
  auto_approval_enabled: false,
  auto_approval_threshold: 300,
  follow_up_wait_days: 10,
  notification_channel: NotificationChannel.SMS,
};

// ── Work Order ──────────────────────────────────────────────

export interface WorkOrder {
  id: string;
  status: WorkOrderStatus;
  created_at: string;
  updated_at: string;

  // Property info
  property_id: string;
  property_address: string;
  unit: string | null;

  // Tenant info
  tenant_id: string;
  tenant_name: string;
  tenant_phone: string;

  // Problem description
  category: Category;
  description: string;
  photos: string[];
  urgency: Urgency;

  // Assignment
  contractor_id: string | null;
  assigned_at: string | null;

  // Quote
  quote_id: string | null;

  // Approval
  approval_required: boolean;
  approval_status: ApprovalStatus | null;
  approved_by: string | null;
  approved_at: string | null;
  pm_recommendation: string | null;

  // Completion
  completion_report_id: string | null;
  completed_at: string | null;

  // Follow-up
  follow_up_status: FollowUpStatus | null;
  follow_up_sent_at: string | null;
  follow_up_deadline: string | null;

  // Hold
  held_from_status: WorkOrderStatus | null;

  // Relations
  parent_work_order_id: string | null;
  owner_id: string;
  pm_id: string;
}

// ── Quote (报价) ────────────────────────────────────────────

export interface MaterialItem {
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Quote {
  id: string;
  work_order_id: string;
  contractor_id: string;

  labor_hours: number;
  labor_rate: number;
  labor_cost: number;
  materials: MaterialItem[];
  materials_cost: number;
  other_cost: number;
  other_description: string | null;
  total: number;

  estimated_completion: string;
  notes: string | null;

  submitted_at: string;
}

// ── Completion Report (完工报告) ────────────────────────────

export interface CompletionReport {
  id: string;
  work_order_id: string;
  contractor_id: string;

  work_type: WorkType;
  work_description: string;

  actual_materials: MaterialItem[];
  actual_materials_cost: number;
  actual_labor_hours: number;
  actual_labor_rate: number;
  actual_labor_cost: number;
  actual_other_cost: number;
  actual_total: number;

  completion_photos: string[];
  recommendations: string | null;

  submitted_at: string;
}

// ── State Machine Transitions ───────────────────────────────

export interface StateTransition {
  from: WorkOrderStatus;
  to: WorkOrderStatus;
  trigger: string;
  auto: boolean;
}

export const VALID_TRANSITIONS: StateTransition[] = [
  // Normal flow
  { from: WorkOrderStatus.PendingAssignment, to: WorkOrderStatus.Assigned, trigger: "pm_assign_contractor", auto: false },
  { from: WorkOrderStatus.Assigned, to: WorkOrderStatus.Quoting, trigger: "contractor_start_quote", auto: false },
  { from: WorkOrderStatus.Quoting, to: WorkOrderStatus.InProgress, trigger: "quote_auto_approved", auto: true },
  { from: WorkOrderStatus.Quoting, to: WorkOrderStatus.PendingApproval, trigger: "quote_needs_approval", auto: true },

  // Approval flow
  { from: WorkOrderStatus.PendingApproval, to: WorkOrderStatus.InProgress, trigger: "owner_approve", auto: false },
  { from: WorkOrderStatus.PendingApproval, to: WorkOrderStatus.PendingAssignment, trigger: "owner_reject", auto: false },

  // Completion flow
  { from: WorkOrderStatus.InProgress, to: WorkOrderStatus.PendingVerification, trigger: "contractor_submit_completion", auto: false },
  { from: WorkOrderStatus.PendingVerification, to: WorkOrderStatus.Completed, trigger: "tenant_confirm", auto: false },
  { from: WorkOrderStatus.PendingVerification, to: WorkOrderStatus.Completed, trigger: "pm_manual_close", auto: false },
  { from: WorkOrderStatus.PendingVerification, to: WorkOrderStatus.Completed, trigger: "auto_timeout", auto: true },
  { from: WorkOrderStatus.PendingVerification, to: WorkOrderStatus.Completed, trigger: "tenant_report_issue", auto: true },

  // Cancel / Hold — from any active status
  ...([
    WorkOrderStatus.PendingAssignment,
    WorkOrderStatus.Assigned,
    WorkOrderStatus.Quoting,
    WorkOrderStatus.PendingApproval,
    WorkOrderStatus.InProgress,
    WorkOrderStatus.PendingVerification,
  ] as const).flatMap((status) => [
    { from: status, to: WorkOrderStatus.Cancelled, trigger: "pm_cancel", auto: false },
    { from: status, to: WorkOrderStatus.OnHold, trigger: "pm_hold", auto: false },
  ]),

  // Resume from hold — can resume to any previously active status
  ...([
    WorkOrderStatus.PendingAssignment,
    WorkOrderStatus.Assigned,
    WorkOrderStatus.Quoting,
    WorkOrderStatus.PendingApproval,
    WorkOrderStatus.InProgress,
    WorkOrderStatus.PendingVerification,
  ] as const).map((status) => ({
    from: WorkOrderStatus.OnHold,
    to: status,
    trigger: "pm_resume" as const,
    auto: false as const,
  })),
];

export function isValidTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return VALID_TRANSITIONS.some((t) => t.from === from && t.to === to);
}
