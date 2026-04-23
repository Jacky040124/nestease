/** Shared cost calculation logic for quotes and completion reports. */

export interface MaterialInput {
  name: string;
  quantity: number;
  unit_price: number;
}

export interface MaterialWithSubtotal extends MaterialInput {
  subtotal: number;
}

export interface CostBreakdown {
  laborCost: number;
  materialsCost: number;
  otherCost: number;
  total: number;
  materialsWithSubtotals: MaterialWithSubtotal[];
}

export function calculateCosts(
  laborHours: number,
  laborRate: number,
  materials: MaterialInput[] | null | undefined,
  otherCost: number,
): CostBreakdown {
  const lh = laborHours || 0;
  const lr = laborRate || 0;
  const laborCost = lh * lr;

  const materialsList = materials || [];
  const materialsWithSubtotals: MaterialWithSubtotal[] = materialsList.map((m) => ({
    ...m,
    subtotal: (m.quantity || 0) * (m.unit_price || 0),
  }));
  const materialsCost = materialsWithSubtotals.reduce((sum, m) => sum + m.subtotal, 0);
  const oc = otherCost || 0;
  const total = laborCost + materialsCost + oc;

  return { laborCost, materialsCost, otherCost: oc, total, materialsWithSubtotals };
}
