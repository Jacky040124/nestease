import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────

const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn() });
const mockFrom = vi.fn(() => ({
  select: () => ({
    eq: () => ({
      single: () => ({ data: { phone: "+17781234567" }, error: null }),
    }),
  }),
  update: mockUpdate,
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

const mockSendSMS = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/sms", () => ({
  sendSMS: (...args: unknown[]) => mockSendSMS(...args),
}));

vi.mock("@/lib/token", () => ({
  generateToken: vi.fn().mockReturnValue("mock-token-abc"),
}));

import { dispatchNotification } from "@/lib/send-notification";

// ── Tests ─────────────────────────────────────────────────────

describe("Send Notification — dispatchNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset sendSMS to return true by default
    mockSendSMS.mockResolvedValue(true);
  });

  const baseArgs = {
    notificationId: "notif-1",
    workOrderId: "wo-1",
    targetRole: "contractor",
    targetId: "c-1",
    event: "new_work_order",
    message: "新工单通知",
  };

  it("looks up phone number from the correct table", async () => {
    await dispatchNotification(baseArgs);
    expect(mockFrom).toHaveBeenCalledWith("contractor");
  });

  it("sends SMS with the message", async () => {
    await dispatchNotification(baseArgs);
    expect(mockSendSMS).toHaveBeenCalledWith(
      "+17781234567",
      expect.stringContaining("新工单通知")
    );
  });

  it("includes login-protected link for contractor events (no token)", async () => {
    await dispatchNotification(baseArgs);
    const smsBody = mockSendSMS.mock.calls[0][1] as string;
    expect(smsBody).toContain("/contractor/quote/wo-1");
    expect(smsBody).not.toContain("token=");
    expect(smsBody).toContain("点击查看详情并提交报价");
  });

  it("includes signed link for owner events", async () => {
    await dispatchNotification({
      ...baseArgs,
      targetRole: "owner",
      targetId: "o-1",
      event: "approval_needed",
    });
    const smsBody = mockSendSMS.mock.calls[0][1] as string;
    expect(smsBody).toContain("/approve?");
    expect(smsBody).toContain("owner_id=o-1");
    expect(smsBody).toContain("点击审批");
  });

  it("includes signed link for tenant events", async () => {
    await dispatchNotification({
      ...baseArgs,
      targetRole: "tenant",
      targetId: "t-1",
      event: "completion_submitted",
    });
    const smsBody = mockSendSMS.mock.calls[0][1] as string;
    expect(smsBody).toContain("/verify?");
    expect(smsBody).toContain("点击确认验收");
  });

  it("uses dashboard link without token for PM events", async () => {
    await dispatchNotification({
      ...baseArgs,
      targetRole: "pm",
      targetId: "pm-1",
      event: "quote_submitted",
    });
    const smsBody = mockSendSMS.mock.calls[0][1] as string;
    expect(smsBody).toContain("/dashboard");
    expect(smsBody).not.toContain("token=");
  });

  it("uses contractor completion-report link for approved_start_work (no token)", async () => {
    await dispatchNotification({
      ...baseArgs,
      event: "approved_start_work",
    });
    const smsBody = mockSendSMS.mock.calls[0][1] as string;
    expect(smsBody).toContain("/contractor/completion-report/wo-1");
    expect(smsBody).not.toContain("token=");
    expect(smsBody).toContain("完工后点击提交完工报告");
  });

  it("marks notification as sent in DB when SMS succeeds", async () => {
    mockSendSMS.mockResolvedValue(true);
    await dispatchNotification(baseArgs);
    expect(mockFrom).toHaveBeenCalledWith("notification");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ sent: true })
    );
  });

  it("does not mark notification as sent when SMS fails", async () => {
    mockSendSMS.mockResolvedValue(false);
    await dispatchNotification(baseArgs);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does not mark notification as sent when notificationId is missing", async () => {
    mockSendSMS.mockResolvedValue(true);
    await dispatchNotification({ ...baseArgs, notificationId: undefined });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("skips SMS when phone number is not found", async () => {
    // Override the mock to return null phone
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: () => ({ data: null, error: null }),
        }),
      }),
    });
    await dispatchNotification(baseArgs);
    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  it("handles events without link config (no link in SMS)", async () => {
    await dispatchNotification({
      ...baseArgs,
      event: "unknown_event",
    });
    const smsBody = mockSendSMS.mock.calls[0][1] as string;
    // Should just be the plain message without any link
    expect(smsBody).toBe("新工单通知");
  });
});
