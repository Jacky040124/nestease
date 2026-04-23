import { describe, it, expect } from "vitest";
import { calculateCosts, MaterialInput } from "@/lib/cost-calculator";

describe("Cost Calculator — calculateCosts", () => {
  describe("labor cost", () => {
    it("calculates labor = hours * rate", () => {
      const result = calculateCosts(5, 80, null, 0);
      expect(result.laborCost).toBe(400);
    });

    it("handles zero hours", () => {
      const result = calculateCosts(0, 80, null, 0);
      expect(result.laborCost).toBe(0);
    });

    it("handles zero rate", () => {
      const result = calculateCosts(5, 0, null, 0);
      expect(result.laborCost).toBe(0);
    });

    it("treats falsy hours as 0", () => {
      const result = calculateCosts(undefined as unknown as number, 80, null, 0);
      expect(result.laborCost).toBe(0);
    });

    it("treats falsy rate as 0", () => {
      const result = calculateCosts(5, undefined as unknown as number, null, 0);
      expect(result.laborCost).toBe(0);
    });
  });

  describe("materials cost", () => {
    it("calculates subtotals and total materials cost", () => {
      const materials: MaterialInput[] = [
        { name: "Pipe", quantity: 3, unit_price: 10 },
        { name: "Fitting", quantity: 5, unit_price: 2 },
      ];
      const result = calculateCosts(0, 0, materials, 0);
      expect(result.materialsWithSubtotals[0].subtotal).toBe(30);
      expect(result.materialsWithSubtotals[1].subtotal).toBe(10);
      expect(result.materialsCost).toBe(40);
    });

    it("handles null materials", () => {
      const result = calculateCosts(0, 0, null, 0);
      expect(result.materialsCost).toBe(0);
      expect(result.materialsWithSubtotals).toEqual([]);
    });

    it("handles undefined materials", () => {
      const result = calculateCosts(0, 0, undefined, 0);
      expect(result.materialsCost).toBe(0);
      expect(result.materialsWithSubtotals).toEqual([]);
    });

    it("handles empty materials array", () => {
      const result = calculateCosts(0, 0, [], 0);
      expect(result.materialsCost).toBe(0);
      expect(result.materialsWithSubtotals).toEqual([]);
    });

    it("treats falsy quantity/unit_price as 0", () => {
      const materials: MaterialInput[] = [
        { name: "X", quantity: 0, unit_price: 10 },
        { name: "Y", quantity: 5, unit_price: 0 },
      ];
      const result = calculateCosts(0, 0, materials, 0);
      expect(result.materialsWithSubtotals[0].subtotal).toBe(0);
      expect(result.materialsWithSubtotals[1].subtotal).toBe(0);
      expect(result.materialsCost).toBe(0);
    });

    it("preserves original material fields in output", () => {
      const materials: MaterialInput[] = [
        { name: "Valve", quantity: 2, unit_price: 15 },
      ];
      const result = calculateCosts(0, 0, materials, 0);
      expect(result.materialsWithSubtotals[0]).toMatchObject({
        name: "Valve",
        quantity: 2,
        unit_price: 15,
        subtotal: 30,
      });
    });
  });

  describe("other cost", () => {
    it("passes through other cost", () => {
      const result = calculateCosts(0, 0, null, 50);
      expect(result.otherCost).toBe(50);
    });

    it("treats falsy other cost as 0", () => {
      const result = calculateCosts(0, 0, null, undefined as unknown as number);
      expect(result.otherCost).toBe(0);
    });
  });

  describe("total", () => {
    it("sums labor + materials + other", () => {
      const materials: MaterialInput[] = [
        { name: "Part", quantity: 2, unit_price: 25 },
      ];
      const result = calculateCosts(3, 100, materials, 30);
      // labor: 300, materials: 50, other: 30
      expect(result.total).toBe(380);
    });

    it("total is 0 when all inputs are 0", () => {
      const result = calculateCosts(0, 0, null, 0);
      expect(result.total).toBe(0);
    });
  });
});
