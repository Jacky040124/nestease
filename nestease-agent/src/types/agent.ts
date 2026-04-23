/**
 * Type definitions for the 龙虾 AI Agent.
 */

/** Agent session stored in Supabase */
export interface AgentSession {
  session_id: string;
  contractor_id: string;
  pm_id: string;
  status: string;
  confirmed: boolean;
  agent_id: string;
  thread_id: string;
  created_at: string;
}

/** Standard result shape returned by tool handlers */
export interface ToolResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

/** Material item within a quote */
export interface MaterialItem {
  name: string;
  quantity: number;
  unit_price: number;
}

// ── Per-tool input shapes ──────────────────────────────────────────────

export interface GetWorkOrderInput {
  work_order_id: string;
}

export interface ListWorkOrdersInput {
  contractor_id: string;
}

export interface AcceptWorkOrderInput {
  work_order_id: string;
}

export interface SubmitQuoteInput {
  work_order_id: string;
  labor_hours: number;
  labor_rate: number;
  materials: MaterialItem[];
  other_cost?: number;
  other_description?: string;
  estimated_completion: string;
  notes?: string;
}

export interface SubmitCompletionInput {
  work_order_id: string;
  completion_notes: string;
  photo_urls?: string[];
}

export interface NotifyPmInput {
  work_order_id?: string;
  reason: string;
  urgency?: "normal" | "urgent";
}

export interface ConfirmIdentityInput {
  contractor_id: string;
  pm_id: string;
}

export interface SaveMemoryInput {
  pm_id: string;
  key: string;
  content: string;
}

export interface GetMemoriesInput {
  contractor_id: string;
  pm_id: string;
}

/** Union of all tool input shapes */
export type ToolInput =
  | GetWorkOrderInput
  | ListWorkOrdersInput
  | AcceptWorkOrderInput
  | SubmitQuoteInput
  | SubmitCompletionInput
  | NotifyPmInput
  | ConfirmIdentityInput
  | SaveMemoryInput
  | GetMemoriesInput;
