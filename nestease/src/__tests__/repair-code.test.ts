import { describe, it, expect } from "vitest";
import { generateRepairCode } from "@/lib/repair-code";

describe("generateRepairCode", () => {
  it("produces a 6-character string", () => {
    const code = generateRepairCode();
    expect(code).toHaveLength(6);
  });

  it("alternates letters and digits (L-D-L-D-L-D)", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRepairCode();
      expect(code[0]).toMatch(/[A-Z]/);
      expect(code[1]).toMatch(/[0-9]/);
      expect(code[2]).toMatch(/[A-Z]/);
      expect(code[3]).toMatch(/[0-9]/);
      expect(code[4]).toMatch(/[A-Z]/);
      expect(code[5]).toMatch(/[0-9]/);
    }
  });

  it("excludes ambiguous characters (I, O, 0, 1)", () => {
    const codes = Array.from({ length: 200 }, () => generateRepairCode());
    const allChars = codes.join("");
    expect(allChars).not.toContain("I");
    expect(allChars).not.toContain("O");
    expect(allChars).not.toContain("0");
    expect(allChars).not.toContain("1");
  });

  it("generates unique codes (high probability)", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateRepairCode()));
    // With 24^3 * 8^3 = 7,077,888 possible codes, 100 should all be unique
    expect(codes.size).toBe(100);
  });
});
