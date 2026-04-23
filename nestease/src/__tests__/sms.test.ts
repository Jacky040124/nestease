import { describe, it, expect } from "vitest";
import { normalizePhone } from "@/lib/sms";

describe("SMS — normalizePhone", () => {
  describe("10-digit North American numbers", () => {
    it("adds +1 prefix to 10-digit number", () => {
      expect(normalizePhone("6045551234")).toBe("+16045551234");
    });

    it("handles number with dashes", () => {
      expect(normalizePhone("778-838-1473")).toBe("+16045551234");
    });

    it("handles number with spaces", () => {
      expect(normalizePhone("778 838 1473")).toBe("+16045551234");
    });

    it("handles number with parentheses", () => {
      expect(normalizePhone("(778) 838-1473")).toBe("+16045551234");
    });

    it("handles number with mixed formatting", () => {
      expect(normalizePhone("(778) 838 1473")).toBe("+16045551234");
    });
  });

  describe("11-digit numbers starting with 1", () => {
    it("adds + prefix to 11-digit number starting with 1", () => {
      expect(normalizePhone("16045551234")).toBe("+16045551234");
    });

    it("handles formatted 11-digit number", () => {
      expect(normalizePhone("1-778-838-1473")).toBe("+16045551234");
    });
  });

  describe("numbers already in E.164 format", () => {
    it("returns number as-is if already starts with +", () => {
      expect(normalizePhone("+16045551234")).toBe("+16045551234");
    });

    it("handles international number with +", () => {
      expect(normalizePhone("+8613800138000")).toBe("+8613800138000");
    });
  });

  describe("other formats (fallback)", () => {
    it("adds + prefix to other digit-only formats", () => {
      expect(normalizePhone("8613800138000")).toBe("+8613800138000");
    });

    it("strips formatting and adds + for non-standard numbers", () => {
      expect(normalizePhone("86-138-0013-8000")).toBe("+8613800138000");
    });
  });
});
