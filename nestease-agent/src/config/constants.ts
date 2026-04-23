/**
 * Shared constants for the 龙虾 AI Agent service.
 */

export const AGENT_MODEL = "claude-sonnet-4-6";
export const COMPANY_NAME = "栖安物管";
export const AGENT_NAME = "龙虾";

// Work order statuses considered "active" (not terminal)
export const ACTIVE_STATUSES = [
  "pending_assignment",
  "assigned",
  "quoting",
  "pending_approval",
  "in_progress",
  "pending_verification",
  "on_hold",
];

// SMS reply templates for non-agent responses
export const SMS_UNKNOWN_PHONE = "抱歉，您的号码未注册。请联系您的物业经理。";
export const SMS_NO_ACTIVE_ORDERS = "目前没有进行中的工单，有新活儿我会通知你。";
export const SMS_SYSTEM_ERROR = "系统暂时出了点问题，你的消息我收到了，稍后回复你。";

export const TIMEZONE = "America/Vancouver";
