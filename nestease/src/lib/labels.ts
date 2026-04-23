/** Canonical label maps — single source of truth for all display strings. */

export const STATUS_LABELS: Record<string, string> = {
  pending_assignment: "待派单",
  assigned: "已派单",
  quoting: "报价中",
  pending_approval: "待审批",
  in_progress: "施工中",
  pending_verification: "待验收",
  completed: "已完成",
  cancelled: "已取消",
  on_hold: "已挂起",
};

export const ACTION_LABELS: Record<string, string> = {
  tenant_submit: "租户提交报修",
  pm_assign_contractor: "PM指派师傅",
  contractor_start_quote: "师傅开始报价",
  submit_quote: "提交报价",
  owner_approve: "业主批准",
  owner_reject: "业主拒绝",
  contractor_submit_completion: "提交完工报告",
  tenant_confirm: "租户确认完工",
  pm_manual_close: "PM手动关闭",
  auto_timeout: "超时自动完成",
  tenant_report_issue: "租户反馈问题",
  pm_cancel: "PM取消工单",
  pm_hold: "PM挂起工单",
  pm_resume: "PM恢复工单",
};

/** Tenant-facing action labels (softer wording for status page). */
export const TENANT_ACTION_LABELS: Record<string, string> = {
  tenant_submit: "报修已收到",
  pm_assign_contractor: "已安排维修师傅",
  contractor_start_quote: "师傅正在评估",
  submit_quote: "报价已提交",
  owner_approve: "报价已通过",
  owner_reject: "报价被拒绝",
  contractor_submit_completion: "维修已完工",
  tenant_confirm: "您已确认完工",
  pm_manual_close: "PM确认完成",
  auto_timeout: "自动确认完成",
  pm_cancel: "工单已取消",
  pm_hold: "工单暂时挂起",
  pm_resume: "工单已恢复",
};

export const CATEGORY_LABELS: Record<string, string> = {
  plumbing: "水管",
  electrical: "电路",
  hvac: "暖通",
  locks: "门锁",
  other: "其他",
};

/** Bilingual category labels for formal documents / PDFs. */
export const CATEGORY_LABELS_BILINGUAL: Record<string, string> = {
  plumbing: "水管 Plumbing",
  electrical: "电路 Electrical",
  hvac: "暖通 HVAC",
  locks: "门锁 Locks",
  other: "其他 Other",
};

export const URGENCY_LABELS: Record<string, string> = {
  normal: "普通",
  urgent: "紧急",
};
