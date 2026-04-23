import { describe, it, expect } from "vitest";
import {
  STATUS_LABELS,
  ACTION_LABELS,
  TENANT_ACTION_LABELS,
  CATEGORY_LABELS,
  CATEGORY_LABELS_BILINGUAL,
  URGENCY_LABELS,
} from "@/lib/labels";
import { WorkOrderStatus } from "@/types";

describe("Labels — completeness", () => {
  describe("STATUS_LABELS", () => {
    it("has a label for every WorkOrderStatus", () => {
      for (const status of Object.values(WorkOrderStatus)) {
        expect(STATUS_LABELS[status], `Missing STATUS_LABELS["${status}"]`).toBeTruthy();
      }
    });
  });

  describe("ACTION_LABELS", () => {
    const expectedActions = [
      "tenant_submit",
      "pm_assign_contractor",
      "contractor_start_quote",
      "submit_quote",
      "owner_approve",
      "owner_reject",
      "contractor_submit_completion",
      "tenant_confirm",
      "pm_manual_close",
      "auto_timeout",
      "tenant_report_issue",
      "pm_cancel",
      "pm_hold",
      "pm_resume",
    ];

    it("has a label for every known action", () => {
      for (const action of expectedActions) {
        expect(ACTION_LABELS[action], `Missing ACTION_LABELS["${action}"]`).toBeTruthy();
      }
    });
  });

  describe("TENANT_ACTION_LABELS", () => {
    it("has a label for every action that has an ACTION_LABEL", () => {
      // tenant_report_issue is intentionally omitted from tenant-facing labels
      const exceptions = ["tenant_report_issue"];
      for (const key of Object.keys(ACTION_LABELS)) {
        if (exceptions.includes(key)) continue;
        expect(
          TENANT_ACTION_LABELS[key],
          `Missing TENANT_ACTION_LABELS["${key}"]`
        ).toBeTruthy();
      }
    });
  });

  describe("CATEGORY_LABELS", () => {
    const categories = ["plumbing", "electrical", "hvac", "locks", "other"];

    it("has a label for every category", () => {
      for (const cat of categories) {
        expect(CATEGORY_LABELS[cat], `Missing CATEGORY_LABELS["${cat}"]`).toBeTruthy();
      }
    });
  });

  describe("CATEGORY_LABELS_BILINGUAL", () => {
    it("has the same keys as CATEGORY_LABELS", () => {
      for (const key of Object.keys(CATEGORY_LABELS)) {
        expect(
          CATEGORY_LABELS_BILINGUAL[key],
          `Missing CATEGORY_LABELS_BILINGUAL["${key}"]`
        ).toBeTruthy();
      }
    });
  });

  describe("URGENCY_LABELS", () => {
    it("has normal and urgent labels", () => {
      expect(URGENCY_LABELS["normal"]).toBeTruthy();
      expect(URGENCY_LABELS["urgent"]).toBeTruthy();
    });
  });
});
