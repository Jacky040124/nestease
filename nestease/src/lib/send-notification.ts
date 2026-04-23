import { supabaseAdmin } from "@/lib/supabase";
import { generateToken } from "@/lib/token";
import { sendSMS } from "@/lib/sms";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nestease-weld.vercel.app";

// Map notification events to the portal page + role the recipient should use
const EVENT_LINK_MAP: Record<string, { path: string; role: string; useContractorRoute?: boolean }> = {
  // Contractor receives link to login-protected pages (no token needed)
  new_work_order: { path: "/contractor/quote", role: "contractor", useContractorRoute: true },
  approved_start_work: { path: "/contractor/completion-report", role: "contractor", useContractorRoute: true },

  // PM receives link to work order detail (no token needed)
  quote_submitted: { path: "/dashboard/work-orders", role: "pm" },
  owner_approved: { path: "/dashboard/work-orders", role: "pm" },
  owner_rejected: { path: "/dashboard/work-orders", role: "pm" },
  tenant_reported_issue: { path: "/dashboard/work-orders", role: "pm" },

  // Tenant receives link to verify page
  completion_submitted: { path: "/verify", role: "tenant" },
};

// Human-readable labels for links in SMS
const EVENT_LINK_LABELS: Record<string, string> = {
  new_work_order: "查看详情",
  approved_start_work: "查看详情",
  completion_submitted: "点击确认",
};

// Look up a person's phone number from their role + ID
async function getPhoneNumber(role: string, targetId: string): Promise<string | null> {
  const tableMap: Record<string, string> = {
    pm: "pm",
    contractor: "contractor",
    owner: "owner",
    tenant: "tenant",
  };
  const table = tableMap[role];
  if (!table) return null;

  const { data } = await supabaseAdmin
    .from(table)
    .select("phone")
    .eq("id", targetId)
    .single();

  return data?.phone || null;
}

/**
 * Send a notification via SMS, including a signed portal link when applicable.
 * Call this after inserting the notification record into the DB.
 */
export async function dispatchNotification({
  notificationId,
  workOrderId,
  targetRole,
  targetId,
  event,
  message,
}: {
  notificationId?: string;
  workOrderId: string;
  targetRole: string;
  targetId: string;
  event: string;
  message: string;
}): Promise<void> {
  // Skip contractor SMS — 龙虾 Agent handles contractor notifications
  if (targetRole === "contractor") {
    console.log(`[notify] Contractor ${targetId}: skipping template SMS, handled by Agent`);
    return;
  }

  // Skip PM SMS — PM monitors dashboard directly
  if (targetRole === "pm") {
    console.log(`[notify] PM ${targetId}: skipping template SMS, PM uses dashboard`);
    return;
  }

  const phone = await getPhoneNumber(targetRole, targetId);
  if (!phone) {
    console.warn(`[notify] No phone for ${targetRole}:${targetId}, skipping`);
    return;
  }

  // Build the link if applicable
  const linkConfig = EVENT_LINK_MAP[event];
  let smsBody = message;

  if (linkConfig && linkConfig.useContractorRoute && targetRole === "contractor") {
    // Contractor routes use login-based auth — no token needed, path includes work order ID
    const url = `${BASE_URL}${linkConfig.path}/${workOrderId}`;
    const linkLabel = EVENT_LINK_LABELS[event] || "查看详情";
    smsBody = `${message}\n\n${linkLabel}：\n${url}`;
  } else if (targetRole === "pm") {
    // PM always gets dashboard link
    const url = `${BASE_URL}/dashboard/work-orders?selected=${workOrderId}`;
    smsBody = `${message}\n\n查看详情：\n${url}`;
  } else if (linkConfig && linkConfig.role !== "pm") {
    // Other external roles (owner, tenant) still use signed token links
    const token = generateToken({
      workOrderId,
      role: linkConfig.role,
      actorId: targetId,
    });
    const params = new URLSearchParams({ id: workOrderId, token });
    if (targetRole === "owner") params.set("owner_id", targetId);
    const url = `${BASE_URL}${linkConfig.path}?${params.toString()}`;
    const linkLabel = EVENT_LINK_LABELS[event] || "查看详情";
    smsBody = `${message}\n\n${linkLabel}：\n${url}`;
  }

  const sent = await sendSMS(phone, smsBody);

  // Mark notification as sent in DB
  if (sent && notificationId) {
    await supabaseAdmin
      .from("notification")
      .update({ sent: true, sent_at: new Date().toISOString() })
      .eq("id", notificationId);
  }
}
