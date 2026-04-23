/**
 * Tool Definitions: custom tool schemas for the 龙虾 AI Agent.
 */

export const CUSTOM_TOOLS = [
  {
    type: "custom" as const,
    name: "get_work_order",
    description:
      "查询工单详情。根据工单ID获取工单的完整信息，包括地址、问题描述、当前状态、分配的师傅等。在回复师傅关于工单的问题时，必须先调用此工具获取最新信息，绝对不能凭记忆回答。",
    input_schema: {
      type: "object" as const,
      properties: {
        work_order_id: { type: "string", description: "工单ID" },
      },
      required: ["work_order_id"],
    },
  },
  {
    type: "custom" as const,
    name: "list_work_orders",
    description:
      "列出某个师傅当前所有活跃工单。返回工单列表，每个工单包含ID、地址、问题描述和当前状态。用于帮师傅查看他有哪些活跃工单。",
    input_schema: {
      type: "object" as const,
      properties: {
        contractor_id: { type: "string", description: "师傅的ID" },
      },
      required: ["contractor_id"],
    },
  },
  {
    type: "custom" as const,
    name: "accept_work_order",
    description:
      "师傅接受工单。师傅明确说'接'或'可以做'后才能调用。调用后工单状态从 assigned 变为 quoting，表示师傅已接单并开始准备报价。必须在师傅明确确认后才能调用。",
    input_schema: {
      type: "object" as const,
      properties: {
        work_order_id: { type: "string", description: "工单ID" },
      },
      required: ["work_order_id"],
    },
  },
  {
    type: "custom" as const,
    name: "submit_quote",
    description:
      "提交师傅的报价到系统。必须在师傅明确确认报价明细后才能调用。调用前必须已经向师傅复述了完整报价（工时×时薪、材料逐项、其他费用、预计完工日期）并得到确认。",
    input_schema: {
      type: "object" as const,
      properties: {
        work_order_id: { type: "string", description: "工单ID" },
        labor_hours: { type: "number", description: "人工工时（小时），例如 3 表示 3 小时" },
        labor_rate: { type: "number", description: "人工时薪（加元/小时），例如 80 表示 $80/h" },
        materials: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "材料名称" },
              quantity: { type: "number", description: "数量" },
              unit_price: { type: "number", description: "单价（加元）" },
            },
            required: ["name", "quantity", "unit_price"],
          },
          description: "材料明细数组。例：[{\"name\":\"水龙头\",\"quantity\":1,\"unit_price\":200}]。没有材料填空数组 []",
        },
        other_cost: { type: "number", description: "其他费用（加元），没有填 0" },
        other_description: { type: "string", description: "其他费用说明，如出行费、垃圾清理费等" },
        estimated_completion: { type: "string", description: "预计完工日期，格式 YYYY-MM-DD。师傅说'大概三天'就算成具体日期" },
        notes: { type: "string", description: "备注说明" },
      },
      required: ["work_order_id", "labor_hours", "labor_rate", "materials", "estimated_completion"],
    },
  },
  {
    type: "custom" as const,
    name: "submit_completion",
    description:
      "提交师傅的完工报告。师傅说完工了，你需要收集实际工时、实际材料、工作类型等信息，整理好后跟师傅确认，师傅说'对'或'可以'后调用。如果师傅发了照片，把照片URL一起提交。",
    input_schema: {
      type: "object" as const,
      properties: {
        work_order_id: { type: "string", description: "工单ID" },
        work_type: {
          type: "string",
          enum: ["repair", "replacement", "cleaning", "other"],
          description: "工作类型：repair（维修）、replacement（更换）、cleaning（清洁）、other（其他）",
        },
        completion_notes: { type: "string", description: "完工描述，至少10个字" },
        actual_labor_hours: { type: "number", description: "实际工时（小时），可能跟报价不同" },
        actual_labor_rate: { type: "number", description: "实际时薪（美元）" },
        actual_materials: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "材料名称" },
              quantity: { type: "number", description: "数量" },
              unit_price: { type: "number", description: "单价" },
            },
            required: ["name", "quantity", "unit_price"],
          },
          description: "实际使用的材料列表",
        },
        actual_other_cost: { type: "number", description: "其他费用（如出行费、垃圾清理费等），没有就填0" },
        photo_urls: {
          type: "array",
          items: { type: "string" },
          description: "完工照片URL列表（师傅通过MMS发送的照片）",
        },
      },
      required: ["work_order_id", "work_type", "completion_notes", "actual_labor_hours", "actual_labor_rate", "actual_materials"],
    },
  },
  {
    type: "custom" as const,
    name: "notify_pm",
    description:
      "通知PM需要介入处理。当遇到你无法处理的情况时调用，包括：安全隐患、付款纠纷、师傅投诉、价格谈判、或任何你不确定的事情。",
    input_schema: {
      type: "object" as const,
      properties: {
        work_order_id: { type: "string", description: "相关工单ID（如果有的话）" },
        reason: { type: "string", description: "需要PM介入的原因" },
        urgency: {
          type: "string",
          enum: ["normal", "urgent"],
          description: "紧急程度，默认 normal",
        },
      },
      required: ["reason"],
    },
  },
  {
    type: "custom" as const,
    name: "confirm_identity",
    description:
      "确认师傅身份。首次接触时，师傅明确回复'是'或确认自己身份后调用。调用后后续对话不再需要身份确认。",
    input_schema: {
      type: "object" as const,
      properties: {
        contractor_id: { type: "string", description: "师傅的ID" },
      },
      required: ["contractor_id"],
    },
  },
  {
    type: "custom" as const,
    name: "save_memory",
    description:
      "保存对师傅的观察和记忆。用于记录师傅的特点、偏好、擅长领域等非结构化信息。同一个 key 会覆盖旧内容。",
    input_schema: {
      type: "object" as const,
      properties: {
        key: {
          type: "string",
          description: "记忆分类，如：擅长领域、沟通偏好、注意事项、工作习惯",
        },
        content: { type: "string", description: "具体内容" },
      },
      required: ["key", "content"],
    },
  },
  {
    type: "custom" as const,
    name: "get_memories",
    description:
      "读取某个师傅的所有记忆。用于了解师傅的历史特点和偏好。",
    input_schema: {
      type: "object" as const,
      properties: {
        contractor_id: { type: "string", description: "师傅的ID" },
      },
      required: ["contractor_id"],
    },
  },
];
