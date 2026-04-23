import { describe, it, expect } from "vitest";
import { getNotificationMessage, NotificationContext } from "@/lib/notification-messages";

const baseCtx: NotificationContext = {
  workOrderId: "wo-test-1234-5678",
  address: "6060 No. 3 Rd, Richmond",
  unit: "201",
  description: "地下室水管破裂",
  amount: 500,
  tenantName: "张三",
  tenantPhone: "+17781234567",
  tenantEmail: "zhang@test.com",
};

describe("Notification Messages — getNotificationMessage", () => {
  describe("new_work_order", () => {
    it("is a short one-liner with 栖安 prefix", () => {
      const msg = getNotificationMessage("new_work_order", baseCtx);
      expect(msg).toContain("【栖安】");
      expect(msg).toContain("维修任务");
      // Should NOT contain detailed info
      expect(msg).not.toContain("6060");
      expect(msg).not.toContain("租户");
    });
  });

  describe("quote_submitted", () => {
    it("is a short one-liner with 栖安 prefix", () => {
      const msg = getNotificationMessage("quote_submitted", baseCtx);
      expect(msg).toContain("【栖安】");
      expect(msg).toContain("报价");
    });
  });

  describe("approval_needed", () => {
    it("is a short one-liner with 栖安 prefix", () => {
      const msg = getNotificationMessage("approval_needed", baseCtx);
      expect(msg).toContain("【栖安】");
      expect(msg).toContain("审批");
      expect(msg).not.toContain("$500");
    });
  });

  describe("approved_start_work", () => {
    it("is a short one-liner with 栖安 prefix", () => {
      const msg = getNotificationMessage("approved_start_work", baseCtx);
      expect(msg).toContain("【栖安】");
      expect(msg).toContain("报价已批准");
      // Should NOT contain detailed info
      expect(msg).not.toContain("6060");
    });
  });

  describe("owner_approved", () => {
    it("contains 批准", () => {
      const msg = getNotificationMessage("owner_approved", baseCtx);
      expect(msg).toContain("【栖安】");
      expect(msg).toContain("已获业主批准");
    });
  });

  describe("owner_rejected", () => {
    it("contains 拒绝", () => {
      const msg = getNotificationMessage("owner_rejected", baseCtx);
      expect(msg).toContain("【栖安】");
      expect(msg).toContain("被业主拒绝");
    });
  });

  describe("completion_submitted", () => {
    it("contains 完工 and 验收", () => {
      const msg = getNotificationMessage("completion_submitted", baseCtx);
      expect(msg).toContain("【栖安】");
      expect(msg).toContain("已完工");
      expect(msg).toContain("验收");
    });
  });

  describe("tenant_reported_issue", () => {
    it("contains 仍有问题", () => {
      const msg = getNotificationMessage("tenant_reported_issue", baseCtx);
      expect(msg).toContain("【栖安】");
      expect(msg).toContain("仍有问题");
    });
  });

  describe("unknown event", () => {
    it("falls back to workOrderId prefix and event name", () => {
      const msg = getNotificationMessage("unknown_event", baseCtx);
      expect(msg).toContain("wo-test-");
      expect(msg).toContain("unknown_event");
    });
  });
});
