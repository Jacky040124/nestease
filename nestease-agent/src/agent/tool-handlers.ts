/**
 * Tool Handlers: execute custom tools against Supabase.
 *
 * These call the nestease transition API to ensure all state changes
 * go through the state machine. We do NOT bypass the state machine.
 *
 * Phase 1 MVP: call Supabase directly with transition logic inline.
 * Future: call the nestease API endpoint instead.
 */

import { supabase } from "../lib/supabase.js";
import { sendSMS } from "../sms/sender.js";
import { confirmSession } from "./session-confirm.js";
import { ACTIVE_STATUSES } from "../config/constants.js";
import { validateWorkOrderAccess } from "./validate-work-order.js";
import type { ToolResult } from "../types/agent.js";

/**
 * Look up pm_id from the contractor table.
 * Used instead of relying on agent-provided pm_id (agent only knows PM name, not UUID).
 */
async function getPmIdForContractor(contractorId: string): Promise<string> {
  const { data } = await supabase
    .from("contractor")
    .select("pm_id")
    .eq("id", contractorId)
    .single();
  if (!data?.pm_id) throw new Error(`No PM found for contractor ${contractorId}`);
  return data.pm_id;
}

export async function handleToolCall(
  toolName: string,
  input: Record<string, unknown>,
  contractorId: string,
): Promise<unknown> {
  try {
    switch (toolName) {
      case "get_work_order":
        return await getWorkOrder(input.work_order_id as string);

      case "list_work_orders":
        return await listWorkOrders(input.contractor_id as string || contractorId);

      case "accept_work_order":
        return await acceptWorkOrder(input.work_order_id as string, contractorId);

      case "submit_quote":
        return await submitQuote(
          contractorId,
          input as Record<string, unknown>,
        );

      case "submit_completion":
        return await submitCompletion(
          contractorId,
          input as Record<string, unknown>,
        );

      case "notify_pm":
        return await notifyPm(
          input.work_order_id as string | undefined,
          input.reason as string,
          input.urgency as string | undefined,
          contractorId,
        );

      case "confirm_identity": {
        const pmId = await getPmIdForContractor(contractorId);
        await confirmSession(contractorId, pmId);
        return { success: true, message: "身份已确认" };
      }

      case "save_memory": {
        const pmId = await getPmIdForContractor(contractorId);
        return await saveMemory(
          contractorId,
          pmId,
          input.key as string,
          input.content as string,
        );
      }

      case "get_memories": {
        const pmId = await getPmIdForContractor(contractorId);
        return await getMemories(contractorId, pmId);
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err: any) {
    console.error(`[ToolHandler] ${toolName} failed:`, err.message);
    return { error: err.message };
  }
}

async function getWorkOrder(workOrderId: string) {
  const { data, error } = await supabase
    .from("work_order")
    .select(`
      id, status, property_address, unit, description, category, urgency,
      contractor_id, assigned_at, approval_required, approval_status,
      tenant_name, tenant_phone, photos,
      created_at
    `)
    .eq("id", workOrderId)
    .single();

  if (error || !data) {
    return { error: "工单不存在" };
  }

  // Batch queries: contractor name, quote details, status history
  const [contractorRes, quoteRes, historyRes] = await Promise.all([
    data.contractor_id
      ? supabase.from("contractor").select("name").eq("id", data.contractor_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("quote")
      .select("total, labor_hours, labor_rate, labor_cost, materials, materials_cost, other_cost, other_description, estimated_completion, notes, submitted_at")
      .eq("work_order_id", workOrderId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("work_order_status_history")
      .select("from_status, to_status, action, actor_role, notes, created_at")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const quote = quoteRes.data;
  const history = historyRes.data || [];

  return {
    id: data.id,
    status: data.status,
    address: data.unit ? `${data.property_address} Unit ${data.unit}` : data.property_address,
    description: data.description,
    category: data.category,
    urgency: data.urgency,
    contractor_name: contractorRes.data?.name || "",
    tenant_name: data.tenant_name,
    tenant_phone: data.tenant_phone,
    approval_status: data.approval_status,
    photos: data.photos || [],
    quote: quote
      ? {
          total: quote.total,
          labor_hours: quote.labor_hours,
          labor_rate: quote.labor_rate,
          labor_cost: quote.labor_cost,
          materials: quote.materials,
          materials_cost: quote.materials_cost,
          other_cost: quote.other_cost,
          other_description: quote.other_description,
          estimated_completion: quote.estimated_completion,
          notes: quote.notes,
          submitted_at: quote.submitted_at,
        }
      : null,
    status_history: history,
    created_at: data.created_at,
    assigned_at: data.assigned_at,
  };
}

async function listWorkOrders(contractorId: string) {
  const { data, error } = await supabase
    .from("work_order")
    .select("id, status, property_address, unit, description, category")
    .eq("contractor_id", contractorId)
    .in("status", ACTIVE_STATUSES)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: "查询失败" };
  }

  return (data || []).map((wo) => ({
    id: wo.id,
    status: wo.status,
    address: wo.unit ? `${wo.property_address} Unit ${wo.unit}` : wo.property_address,
    description: wo.description,
    category: wo.category,
  }));
}

async function acceptWorkOrder(workOrderId: string, contractorId: string) {
  const result = await validateWorkOrderAccess(workOrderId, contractorId);
  if (result.error) return result.error;
  const { wo } = result;
  if (wo.status !== "assigned") return { error: `工单状态是 ${wo.status}，不能接单` };

  // Transition: assigned → quoting (contractor_start_quote)
  const { error: updateError } = await supabase
    .from("work_order")
    .update({ status: "quoting", updated_at: new Date().toISOString() })
    .eq("id", workOrderId)
    .eq("status", "assigned"); // optimistic lock

  if (updateError) return { error: "接单失败，请重试" };

  // Log transition
  await supabase.from("work_order_status_history").insert({
    work_order_id: workOrderId,
    from_status: "assigned",
    to_status: "quoting",
    action: "contractor_start_quote",
    actor_id: contractorId,
    actor_role: "contractor",
  });

  return { success: true, message: "已接单，工单状态更新为报价中" };
}

async function submitQuote(
  contractorId: string,
  input: Record<string, unknown>,
) {
  const workOrderId = input.work_order_id as string;
  const laborHours = (input.labor_hours as number) || 0;
  const laborRate = (input.labor_rate as number) || 0;
  const materials = (input.materials as Array<{ name: string; quantity: number; unit_price: number }>) || [];
  const otherCost = (input.other_cost as number) || 0;
  const otherDescription = (input.other_description as string) || "";
  const estimatedCompletion = input.estimated_completion as string | undefined;
  const notes = (input.notes as string) || "";

  // Verify work order
  const result = await validateWorkOrderAccess(workOrderId, contractorId);
  if (result.error) return result.error;
  const { wo } = result;
  if (wo.status !== "quoting") return { error: `工单状态是 ${wo.status}，不能提交报价` };

  // Validate data completeness — reject incomplete submissions so agent collects more info
  if (laborHours <= 0) {
    return { error: "报价缺少工时信息，请先跟师傅确认大概需要多少小时" };
  }
  if (laborRate <= 0) {
    return { error: "报价缺少时薪信息，请跟师傅确认时薪多少" };
  }
  if (!estimatedCompletion) {
    return { error: "报价缺少预计完工日期，请跟师傅确认什么时候能搞完" };
  }

  // Calculate costs
  const laborCost = laborHours * laborRate;
  const materialsWithSubtotals = materials.map((m) => ({
    ...m,
    subtotal: m.quantity * m.unit_price,
  }));
  const materialsCost = materialsWithSubtotals.reduce((sum, m) => sum + m.subtotal, 0);
  const total = laborCost + materialsCost + otherCost;

  // Insert quote record
  const { data: quoteData } = await supabase.from("quote").insert({
    work_order_id: workOrderId,
    contractor_id: contractorId,
    labor_hours: laborHours,
    labor_rate: laborRate,
    labor_cost: laborCost,
    materials: materialsWithSubtotals,
    materials_cost: materialsCost,
    other_cost: otherCost,
    other_description: otherDescription,
    total,
    estimated_completion: estimatedCompletion || null,
    notes,
  }).select("id").single();

  // Check auto-approval
  const { data: pm } = await supabase
    .from("pm")
    .select("auto_approval_enabled, auto_approval_threshold")
    .eq("id", wo.pm_id)
    .single();

  const autoApprove = pm?.auto_approval_enabled && total <= (pm?.auto_approval_threshold || 0);
  const newStatus = autoApprove ? "in_progress" : "pending_approval";
  const trigger = autoApprove ? "quote_auto_approved" : "quote_needs_approval";

  // Transition work order
  const updateFields: Record<string, unknown> = {
    status: newStatus,
    quote_id: quoteData?.id || null,
    updated_at: new Date().toISOString(),
  };

  if (autoApprove) {
    updateFields.approval_required = false;
    updateFields.approval_status = "approved";
  } else {
    updateFields.approval_required = true;
    updateFields.approval_status = "pending";
  }

  const { error: updateError } = await supabase
    .from("work_order")
    .update(updateFields)
    .eq("id", workOrderId)
    .eq("status", "quoting"); // optimistic lock

  if (updateError) return { error: "提交报价失败，请重试" };

  // Log transition
  await supabase.from("work_order_status_history").insert({
    work_order_id: workOrderId,
    from_status: "quoting",
    to_status: newStatus,
    action: trigger,
    actor_id: contractorId,
    actor_role: "contractor",
  });

  // Side effects: notify PM about quote submission
  // (notification dispatched by the existing nestease notification system via DB trigger or Realtime)

  if (autoApprove) {
    return { success: true, message: "报价已提交并自动批准，可以开始施工", auto_approved: true };
  }
  return { success: true, message: "报价已提交，等待业主审批", auto_approved: false };
}

async function submitCompletion(
  contractorId: string,
  input: Record<string, unknown>,
) {
  const workOrderId = input.work_order_id as string;
  const workType = input.work_type as string;
  const completionNotes = input.completion_notes as string;
  const actualLaborHours = (input.actual_labor_hours as number) || 0;
  const actualLaborRate = (input.actual_labor_rate as number) || 0;
  const actualMaterials = (input.actual_materials as Array<{ name: string; quantity: number; unit_price: number }>) || [];
  const actualOtherCost = (input.actual_other_cost as number) || 0;
  const photoUrls = (input.photo_urls as string[]) || [];

  // Basic validation
  if (!workOrderId) return { error: "缺少工单ID" };
  if (!workType) return { error: "缺少工作类型（repair/replacement/cleaning/other）" };
  if (!completionNotes || completionNotes.length < 10) {
    return { error: "完工描述太简单，请跟师傅确认具体做了什么工作（至少描述一下维修内容）" };
  }
  if (actualLaborHours <= 0) {
    return { error: "缺少实际工时，请跟师傅确认实际花了多少小时" };
  }
  if (actualLaborRate <= 0) {
    return { error: "缺少实际时薪，请跟师傅确认时薪" };
  }

  // Call nestease API instead of direct DB access
  const apiUrl = process.env.NESTEASE_API_URL;
  const apiKey = process.env.NESTEASE_INTERNAL_API_KEY;
  if (!apiUrl || !apiKey) {
    console.error("[submitCompletion] Missing NESTEASE_API_URL or NESTEASE_INTERNAL_API_KEY");
    return { error: "系统配置错误，请联系管理员" };
  }

  try {
    const response = await fetch(`${apiUrl}/api/work-orders/${workOrderId}/completion-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": apiKey,
      },
      body: JSON.stringify({
        contractor_id: contractorId,
        work_type: workType,
        work_description: completionNotes,
        actual_labor_hours: actualLaborHours,
        actual_labor_rate: actualLaborRate,
        actual_materials: actualMaterials,
        actual_other_cost: actualOtherCost,
        completion_photos: photoUrls,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error || "提交完工失败";
      console.error(`[submitCompletion] API error ${response.status}: ${errorMsg}`);
      return { error: errorMsg };
    }

    return { success: true, message: "完工报告已提交，等待验收", photos_count: photoUrls.length };
  } catch (err) {
    console.error("[submitCompletion] API call failed:", err);
    return { error: "提交完工失败，请重试" };
  }
}

async function notifyPm(
  workOrderId: string | undefined,
  reason: string,
  urgency: string | undefined,
  contractorId: string,
) {
  // Look up contractor's PM
  const { data: contractor } = await supabase
    .from("contractor")
    .select("pm_id, name")
    .eq("id", contractorId)
    .single();

  if (!contractor) return { error: "找不到师傅信息" };

  // Look up PM phone
  const { data: pm } = await supabase
    .from("pm")
    .select("phone, name")
    .eq("id", contractor.pm_id)
    .single();

  if (!pm?.phone) return { error: "找不到PM联系方式" };

  // Send SMS to PM
  const urgencyTag = urgency === "urgent" ? "【紧急】" : "";
  const woInfo = workOrderId ? `工单: ${workOrderId}\n` : "";
  const smsBody = `${urgencyTag}【栖安】${contractor.name}需要你介入\n${woInfo}原因: ${reason}`;

  await sendSMS(pm.phone, smsBody);

  return { success: true, message: `已通知${pm.name}` };
}

async function saveMemory(
  contractorId: string,
  pmId: string,
  key: string,
  content: string,
) {
  // Upsert: same contractor + pm + key → update content
  const { error } = await supabase
    .from("agent_memories")
    .upsert(
      {
        contractor_id: contractorId,
        pm_id: pmId,
        key,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "contractor_id,pm_id,key" },
    );

  if (error) return { error: "保存记忆失败: " + error.message };
  return { success: true, message: `已记住: ${key}` };
}

async function getMemories(contractorId: string, pmId: string) {
  const { data, error } = await supabase
    .from("agent_memories")
    .select("key, content, updated_at")
    .eq("contractor_id", contractorId)
    .eq("pm_id", pmId)
    .order("updated_at", { ascending: false });

  if (error) return { error: "读取记忆失败" };
  if (!data || data.length === 0) return { memories: [], message: "暂无该师傅的记忆" };

  return {
    memories: data.map((m) => ({ key: m.key, content: m.content })),
  };
}
