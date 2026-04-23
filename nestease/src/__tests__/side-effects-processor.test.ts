import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkOrderStatus, NotificationChannel } from "@/types";
import type { SideEffect } from "@/services/work-order-state-machine";

// ── Mocks ─────────────────────────────────────────────────────

const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({
  insert: mockInsert.mockReturnValue({ select: () => ({ single: () => ({ data: { id: "notif-1" }, error: null }) }) }),
  select: () => ({ eq: () => ({ single: () => ({ data: { email: "tenant@test.com" }, error: null }) }) }),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

const mockDispatch = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/send-notification", () => ({
  dispatchNotification: (...args: unknown[]) => mockDispatch(...args),
}));

import { processSideEffects } from "@/lib/side-effects-processor";

// ── Fixtures ──────────────────────────────────────────────────

const baseWorkOrder = {
  id: "wo-1",
  pm_id: "pm-1",
  owner_id: "owner-1",
  contractor_id: "contractor-1",
  tenant_id: "tenant-1",
  property_id: "prop-1",
  property_address: "123 Main St",
  unit: "101",
  tenant_name: "张三",
  tenant_phone: "+17781234567",
  category: "plumbing",
  description: "水管漏水",
  photos: [],
  urgency: "normal",
};

// ── Tests ─────────────────────────────────────────────────────

describe("Side Effects Processor — processSideEffects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("auto_approve", () => {
    it("sets approval_required=false and approval_status=approved", async () => {
      const effects: SideEffect[] = [{ type: "auto_approve" }];
      const result = await processSideEffects(effects, baseWorkOrder);
      expect(result.approval_required).toBe(false);
      expect(result.approval_status).toBe("approved");
    });
  });

  describe("require_approval", () => {
    it("sets approval_required=true and approval_status=pending", async () => {
      const effects: SideEffect[] = [{ type: "require_approval" }];
      const result = await processSideEffects(effects, baseWorkOrder);
      expect(result.approval_required).toBe(true);
      expect(result.approval_status).toBe("pending");
    });
  });

  describe("save_held_from_status", () => {
    it("records the held_from_status", async () => {
      const effects: SideEffect[] = [
        { type: "save_held_from_status", status: WorkOrderStatus.Quoting },
      ];
      const result = await processSideEffects(effects, baseWorkOrder);
      expect(result.held_from_status).toBe(WorkOrderStatus.Quoting);
    });
  });

  describe("set_follow_up_deadline", () => {
    it("sets follow_up_status, deadline, and sent_at", async () => {
      const effects: SideEffect[] = [
        { type: "set_follow_up_deadline", days: 7 },
      ];
      const result = await processSideEffects(effects, baseWorkOrder);
      expect(result.follow_up_status).toBe("pending_confirmation");
      expect(result.follow_up_deadline).toBeTruthy();
      expect(result.follow_up_sent_at).toBeTruthy();

      // Deadline should be approximately 7 days from now
      const deadline = new Date(result.follow_up_deadline!);
      const now = new Date();
      const diffDays = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(6.9);
      expect(diffDays).toBeLessThan(7.1);
    });
  });

  describe("notify", () => {
    it("resolves PM target to pm_id", async () => {
      const effects: SideEffect[] = [
        { type: "notify", target: "pm", event: "quote_submitted" },
      ];
      await processSideEffects(effects, baseWorkOrder);
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          targetRole: "pm",
          targetId: "pm-1",
          event: "quote_submitted",
        })
      );
    });

    it("resolves contractor target to contractor_id", async () => {
      const effects: SideEffect[] = [
        { type: "notify", target: "contractor", event: "new_work_order" },
      ];
      await processSideEffects(effects, baseWorkOrder);
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          targetRole: "contractor",
          targetId: "contractor-1",
          event: "new_work_order",
        })
      );
    });

    it("resolves owner target to owner_id", async () => {
      const effects: SideEffect[] = [
        { type: "notify", target: "owner", event: "approval_needed" },
      ];
      await processSideEffects(effects, baseWorkOrder);
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          targetRole: "owner",
          targetId: "owner-1",
        })
      );
    });

    it("resolves tenant target to tenant_id", async () => {
      const effects: SideEffect[] = [
        { type: "notify", target: "tenant", event: "completion_submitted" },
      ];
      await processSideEffects(effects, baseWorkOrder);
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          targetRole: "tenant",
          targetId: "tenant-1",
        })
      );
    });

    it("uses extraContractorId when contractor_id is null", async () => {
      const effects: SideEffect[] = [
        { type: "notify", target: "contractor", event: "new_work_order" },
      ];
      const wo = { ...baseWorkOrder, contractor_id: null };
      await processSideEffects(effects, wo, { extraContractorId: "extra-c" });
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ targetId: "extra-c" })
      );
    });

    it("skips notification when target ID cannot be resolved", async () => {
      const effects: SideEffect[] = [
        { type: "notify", target: "contractor", event: "new_work_order" },
      ];
      const wo = { ...baseWorkOrder, contractor_id: null };
      await processSideEffects(effects, wo);
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it("inserts notification record into DB", async () => {
      const effects: SideEffect[] = [
        { type: "notify", target: "pm", event: "quote_submitted" },
      ];
      await processSideEffects(effects, baseWorkOrder, {
        pmSettings: {
          auto_approval_enabled: false,
          auto_approval_threshold: 300,
          follow_up_wait_days: 10,
          notification_channel: NotificationChannel.SMS,
        },
      });
      expect(mockFrom).toHaveBeenCalledWith("notification");
    });
  });

  describe("create_follow_up_work_order", () => {
    it("inserts a new work order with follow-up data", async () => {
      const effects: SideEffect[] = [
        { type: "create_follow_up_work_order", parent_work_order_id: "wo-1" },
      ];
      await processSideEffects(effects, baseWorkOrder);
      expect(mockFrom).toHaveBeenCalledWith("work_order");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: WorkOrderStatus.PendingAssignment,
          property_id: "prop-1",
          description: "[Follow-up] 水管漏水",
          parent_work_order_id: "wo-1",
        })
      );
    });
  });

  describe("multiple effects", () => {
    it("processes all effects and merges update fields", async () => {
      const effects: SideEffect[] = [
        { type: "auto_approve" },
        { type: "notify", target: "pm", event: "quote_submitted" },
        { type: "notify", target: "contractor", event: "approved_start_work" },
      ];
      const result = await processSideEffects(effects, baseWorkOrder);
      expect(result.approval_required).toBe(false);
      expect(result.approval_status).toBe("approved");
      expect(mockDispatch).toHaveBeenCalledTimes(2);
    });
  });

  describe("empty effects", () => {
    it("returns empty update for no effects", async () => {
      const result = await processSideEffects([], baseWorkOrder);
      expect(result).toEqual({});
      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });
});
