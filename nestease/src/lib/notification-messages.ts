// Chinese notification message templates per PRD Section 6

const EVENT_MESSAGES: Record<string, (ctx: NotificationContext) => string> = {
  new_work_order: () =>
    `【栖安】你有一个新的维修任务`,
  quote_submitted: () =>
    `【栖安】有新的维修报价待查看`,
  approval_needed: () =>
    `【栖安】您的物业有一笔维修需要审批`,
  approved_start_work: () =>
    `【栖安】报价已批准，请安排施工`,
  owner_approved: () =>
    `【栖安】维修报价已获业主批准`,
  owner_rejected: () =>
    `【栖安】维修报价被业主拒绝，请重新安排`,
  completion_submitted: () =>
    `【栖安】维修已完工，请确认验收`,
  tenant_reported_issue: () =>
    `【栖安】租户反馈维修仍有问题，已创建后续工单`,
};

export interface NotificationContext {
  workOrderId: string;
  address?: string;
  unit?: string;
  description?: string;
  amount?: number;
  tenantName?: string;
  tenantPhone?: string;
  tenantEmail?: string;
}

export function getNotificationMessage(
  event: string,
  ctx: NotificationContext
): string {
  const template = EVENT_MESSAGES[event];
  if (template) {
    return template(ctx);
  }
  // Fallback for unknown events
  return `工单 ${ctx.workOrderId.slice(0, 8)}: ${event}`;
}
