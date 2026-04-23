/**
 * Shared helper: validate that a work order exists and belongs to the
 * given contractor. Returns the work order row or null (with an error
 * object suitable for returning directly from a tool handler).
 */

import { supabase } from "../lib/supabase.js";

export interface WorkOrderRow {
  id: string;
  status: string;
  contractor_id: string;
  pm_id: string;
}

interface ValidationSuccess {
  wo: WorkOrderRow;
  error: null;
}

interface ValidationFailure {
  wo: null;
  error: { error: string };
}

type ValidationResult = ValidationSuccess | ValidationFailure;

export async function validateWorkOrderAccess(
  workOrderId: string,
  contractorId: string,
): Promise<ValidationResult> {
  const { data: wo, error } = await supabase
    .from("work_order")
    .select("id, status, contractor_id, pm_id")
    .eq("id", workOrderId)
    .single();

  if (error || !wo) {
    return { wo: null, error: { error: "工单不存在" } };
  }

  if (wo.contractor_id !== contractorId) {
    return { wo: null, error: { error: "这个工单不是你的" } };
  }

  return { wo: wo as WorkOrderRow, error: null };
}
