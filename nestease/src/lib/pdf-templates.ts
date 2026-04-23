import { escapeHtml, formatMoney } from "@/lib/utils";
import { ACTION_LABELS, STATUS_LABELS, CATEGORY_LABELS_BILINGUAL as CATEGORY_LABELS, URGENCY_LABELS } from "@/lib/labels";

// ── Types ──────────────────────────────────────────────────────────

export interface Material {
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface StatusHistoryEntry {
  action: string;
  from_status: string | null;
  to_status: string;
  actor_role: string | null;
  created_at: string;
}

// ── Date formatters ────────────────────────────────────────────────

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateEN(date: string): string {
  return new Date(date).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(date: string): string {
  const d = new Date(date);
  return `${d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })} ${d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
}

// ── Shared CSS ─────────────────────────────────────────────────────

const SHARED_STYLES = `
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    @page { margin: 20mm; size: A4; }
    .no-print { display: none !important; }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
    max-width: 816px; margin: 0 auto; padding: 40px 60px;
    color: #000; line-height: 1.6; font-size: 11pt;
  }

  /* Header — simple, like typed in Docs */
  .doc-header { margin-bottom: 8px; }
  .doc-header .company { font-size: 14pt; font-weight: 700; }
  .doc-header .company-en { font-size: 9pt; color: #666; margin-bottom: 12px; }
  .doc-meta { font-size: 9pt; color: #666; margin-bottom: 24px; }

  /* Title — just bold centered text */
  .doc-title {
    text-align: center; font-size: 16pt; font-weight: 700;
    margin: 8px 0 24px;
  }

  /* Section headers — bold with bottom border, like Docs heading style */
  .section-header {
    font-size: 12pt; font-weight: 700; color: #000;
    margin: 24px 0 8px; padding-bottom: 4px;
    border-bottom: 1px solid #000;
  }

  /* Info grid — simple 2-col key:value, no table borders */
  .info-grid { margin-bottom: 16px; }
  .info-row { display: flex; padding: 3px 0; font-size: 11pt; }
  .info-row .label { width: 140px; color: #444; flex-shrink: 0; }
  .info-row .value { flex: 1; }
  .info-2col { display: flex; gap: 40px; margin-bottom: 16px; }
  .info-col { flex: 1; }

  /* Data table — light Google Docs table style */
  .data-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10pt; }
  .data-table th {
    background: #f3f3f3; padding: 6px 10px; text-align: left;
    font-weight: 700; border: 1px solid #d9d9d9; font-size: 10pt;
  }
  .data-table td { padding: 6px 10px; border: 1px solid #d9d9d9; }
  .data-table .right { text-align: right; }
  .data-table .center { text-align: center; }
  .data-table .total-row td { font-weight: 700; border-top: 2px solid #999; }

  /* Plain text block */
  .text-block {
    margin-bottom: 16px; font-size: 11pt; line-height: 1.7;
  }

  /* Timeline */
  .timeline-table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 16px; }
  .timeline-table th {
    background: #f3f3f3; padding: 5px 8px; text-align: left;
    font-weight: 700; border: 1px solid #d9d9d9;
  }
  .timeline-table td { padding: 5px 8px; border: 1px solid #d9d9d9; }

  /* Signature — just underlines */
  .sig-section { margin-top: 40px; }
  .sig-row { display: flex; gap: 80px; margin-bottom: 32px; }
  .sig-item { flex: 1; }
  .sig-item .sig-label { font-size: 10pt; color: #444; margin-bottom: 24px; }
  .sig-item .sig-line { border-bottom: 1px solid #000; }
  .sig-item .sig-date { font-size: 9pt; color: #666; margin-top: 4px; }

  /* Footer — minimal */
  .footer {
    margin-top: 48px; padding-top: 8px;
    border-top: 1px solid #d9d9d9; font-size: 8pt; color: #999;
  }

  /* Notice */
  .notice {
    margin-top: 20px; padding: 12px 16px;
    background: #f8f9fa; border: 1px solid #d9d9d9;
    font-size: 10pt; line-height: 1.6;
  }

  .print-btn {
    position: fixed; bottom: 24px; right: 24px;
    background: #1a73e8; color: white; border: none; border-radius: 4px;
    padding: 8px 16px; font-size: 11pt; cursor: pointer; font-family: inherit;
  }
  .print-btn:hover { background: #1557b0; }
`;

// ── Shared building blocks ─────────────────────────────────────────

function buildHeader(docNo: string, date: string): string {
  return `
  <div class="doc-header">
    <div class="company">栖安物业管理</div>
    <div class="company-en">NestEase Property Management</div>
  </div>
  <div class="doc-meta">文件编号: ${docNo} &nbsp;|&nbsp; 日期: ${date}</div>`;
}

function buildTimelineHTML(history: StatusHistoryEntry[]): string {
  if (!history.length) return "";
  const rows = history.map((h) => `
    <tr>
      <td>${formatDateTime(h.created_at)}</td>
      <td>${ACTION_LABELS[h.action] || h.action}</td>
      <td>${h.to_status ? (STATUS_LABELS[h.to_status] || h.to_status) : "—"}</td>
    </tr>
  `).join("");

  return `
  <div class="section-header">工单时间线</div>
  <table class="timeline-table">
    <thead><tr><th style="width:160px;">时间</th><th>操作</th><th style="width:100px;">状态</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildFooter(docNo: string): string {
  return `
  <div class="footer">栖安物业管理 NestEase Property Management &nbsp;·&nbsp; ${docNo} &nbsp;·&nbsp; ${formatDate(new Date().toISOString())}</div>
  <button class="print-btn no-print" onclick="window.print()">打印 / 保存PDF</button>`;
}

// ── Full-page builders ─────────────────────────────────────────────

export function buildApprovalHTML(
  wo: Record<string, unknown>,
  quote: Record<string, unknown>,
  contractor: Record<string, unknown> | null,
  owner: Record<string, unknown> | null,
  history: StatusHistoryEntry[],
): string {
  const materials = (quote.materials as Material[]) || [];
  const materialsRows = materials.map((m) => `
    <tr>
      <td>${escapeHtml(m.name)}</td>
      <td class="center">${m.quantity}</td>
      <td class="right">${formatMoney(m.unit_price)}</td>
      <td class="right">${formatMoney(m.subtotal)}</td>
    </tr>
  `).join("");

  const woId = (wo.id as string).slice(0, 8).toUpperCase();
  const address = escapeHtml(wo.property_address as string);
  const unit = wo.unit ? `, ${escapeHtml(wo.unit as string)}` : "";
  const docNo = `QA-${woId}`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>维修报价审批单 — ${address}</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  ${buildHeader(docNo, formatDateEN(wo.created_at as string))}

  <div class="doc-title">维修报价审批单</div>

  <div class="section-header">物业信息</div>
  <div class="info-2col">
    <div class="info-col">
      <div class="info-row"><span class="label">物业地址:</span><span class="value">${address}${unit}</span></div>
      <div class="info-row"><span class="label">报修类别:</span><span class="value">${CATEGORY_LABELS[wo.category as string] || escapeHtml(wo.category as string)}</span></div>
      <div class="info-row"><span class="label">业主:</span><span class="value">${owner ? escapeHtml(owner.name as string) : "—"}</span></div>
      <div class="info-row"><span class="label">报修日期:</span><span class="value">${formatDate(wo.created_at as string)}</span></div>
    </div>
    <div class="info-col">
      <div class="info-row"><span class="label">工单编号:</span><span class="value">WO-${woId}</span></div>
      <div class="info-row"><span class="label">紧急程度:</span><span class="value">${URGENCY_LABELS[wo.urgency as string] || wo.urgency}</span></div>
      <div class="info-row"><span class="label">租户:</span><span class="value">${escapeHtml(wo.tenant_name as string)} ${wo.tenant_phone || ""}</span></div>
      <div class="info-row"><span class="label">维修师傅:</span><span class="value">${contractor ? escapeHtml(contractor.name as string) : "—"}${contractor?.phone ? ` ${contractor.phone}` : ""}</span></div>
    </div>
  </div>

  <div class="section-header">问题描述</div>
  <div class="text-block">${escapeHtml(wo.description as string)}</div>

  <div class="section-header">报价明细</div>
  <table class="data-table">
    <thead>
      <tr>
        <th>项目</th>
        <th style="width:60px;" class="center">数量</th>
        <th style="width:90px;" class="right">单价 ($)</th>
        <th style="width:90px;" class="right">小计 ($)</th>
      </tr>
    </thead>
    <tbody>
      ${materialsRows || '<tr><td colspan="4" style="text-align:center;color:#999;">无材料费用</td></tr>'}
      <tr>
        <td>人工费 (${quote.labor_hours}h × ${formatMoney(Number(quote.labor_rate))}/h)</td>
        <td class="center">—</td><td class="right">—</td>
        <td class="right">${formatMoney(Number(quote.labor_cost))}</td>
      </tr>
      ${Number(quote.other_cost) > 0 ? `<tr><td>其他费用${quote.other_description ? ` (${escapeHtml(quote.other_description as string)})` : ""}</td><td class="center">—</td><td class="right">—</td><td class="right">${formatMoney(Number(quote.other_cost))}</td></tr>` : ""}
      <tr class="total-row">
        <td colspan="3" style="text-align:right;padding-right:12px;"><strong>合计</strong></td>
        <td class="right">${formatMoney(Number(quote.total))}</td>
      </tr>
    </tbody>
  </table>

  ${quote.estimated_completion ? `<div class="info-row"><span class="label">预计完工:</span><span class="value">${formatDate(quote.estimated_completion as string)}</span></div>` : ""}
  ${quote.notes ? `<div class="section-header">备注</div><div class="text-block">${escapeHtml(quote.notes as string)}</div>` : ""}

  <div class="notice">
    <strong>审批说明:</strong> 请审阅上述报价内容。如需批准或拒绝，请通过短信中的链接操作，或直接联系物业管理员。
  </div>

  ${buildTimelineHTML(history)}

  <div class="sig-section">
    <div class="sig-row">
      <div class="sig-item">
        <div class="sig-label">业主签字:</div>
        <div class="sig-line"></div>
        <div class="sig-date">日期: _______________</div>
      </div>
      <div class="sig-item">
        <div class="sig-label">管理员确认:</div>
        <div class="sig-line"></div>
        <div class="sig-date">日期: _______________</div>
      </div>
    </div>
  </div>

  ${buildFooter(docNo)}
</body>
</html>`;
}

export function buildCompletionHTML(
  wo: Record<string, unknown>,
  quote: Record<string, unknown> | null,
  report: Record<string, unknown>,
  contractor: Record<string, unknown> | null,
  owner: Record<string, unknown> | null,
  history: StatusHistoryEntry[],
): string {
  const woId = (wo.id as string).slice(0, 8).toUpperCase();
  const address = escapeHtml(wo.property_address as string);
  const unit = wo.unit ? `, ${escapeHtml(wo.unit as string)}` : "";
  const docNo = `CR-${woId}`;

  const actualMaterials = (report.actual_materials as Material[]) || [];
  const materialsRows = actualMaterials.map((m) => `
    <tr>
      <td>${escapeHtml(m.name)}</td>
      <td class="center">${m.quantity}</td>
      <td class="right">${formatMoney(m.unit_price)}</td>
      <td class="right">${formatMoney(m.subtotal)}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>维修完工报告 — ${address}</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  ${buildHeader(docNo, formatDateEN(wo.completed_at ? (wo.completed_at as string) : new Date().toISOString()))}

  <div class="doc-title">维修完工报告</div>

  <div class="section-header">物业信息</div>
  <div class="info-2col">
    <div class="info-col">
      <div class="info-row"><span class="label">物业地址:</span><span class="value">${address}${unit}</span></div>
      <div class="info-row"><span class="label">报修类别:</span><span class="value">${CATEGORY_LABELS[wo.category as string] || escapeHtml(wo.category as string)}</span></div>
      <div class="info-row"><span class="label">业主:</span><span class="value">${owner ? escapeHtml(owner.name as string) : "—"}</span></div>
      <div class="info-row"><span class="label">维修师傅:</span><span class="value">${contractor ? escapeHtml(contractor.name as string) : "—"}${contractor?.phone ? ` ${contractor.phone}` : ""}</span></div>
      <div class="info-row"><span class="label">报修日期:</span><span class="value">${formatDate(wo.created_at as string)}</span></div>
    </div>
    <div class="info-col">
      <div class="info-row"><span class="label">工单编号:</span><span class="value">WO-${woId}</span></div>
      <div class="info-row"><span class="label">紧急程度:</span><span class="value">${URGENCY_LABELS[wo.urgency as string] || wo.urgency}</span></div>
      <div class="info-row"><span class="label">租户:</span><span class="value">${escapeHtml(wo.tenant_name as string)} ${wo.tenant_phone || ""}</span></div>
      <div class="info-row"><span class="label">工单状态:</span><span class="value"><strong>已完成</strong></span></div>
      <div class="info-row"><span class="label">完成日期:</span><span class="value">${wo.completed_at ? formatDate(wo.completed_at as string) : formatDate(new Date().toISOString())}</span></div>
    </div>
  </div>

  <div class="section-header">问题描述</div>
  <div class="text-block">${escapeHtml(wo.description as string)}</div>

  <div class="section-header">维修内容</div>
  <div class="info-row" style="margin-bottom:8px;"><span class="label">维修类型:</span><span class="value">${escapeHtml(report.work_type as string)}</span></div>
  <div class="text-block">${escapeHtml(report.work_description as string)}</div>

  <div class="section-header">费用明细</div>
  <table class="data-table">
    <thead>
      <tr>
        <th>项目</th>
        <th style="width:60px;" class="center">数量</th>
        <th style="width:90px;" class="right">单价 ($)</th>
        <th style="width:90px;" class="right">小计 ($)</th>
      </tr>
    </thead>
    <tbody>
      ${materialsRows || '<tr><td colspan="4" style="text-align:center;color:#999;">无材料费用</td></tr>'}
      <tr>
        <td>人工费 (${report.actual_labor_hours}h × ${formatMoney(Number(report.actual_labor_rate))}/h)</td>
        <td class="center">—</td><td class="right">—</td>
        <td class="right">${formatMoney(Number(report.actual_labor_cost))}</td>
      </tr>
      ${Number(report.actual_other_cost) > 0 ? `<tr><td>其他费用</td><td class="center">—</td><td class="right">—</td><td class="right">${formatMoney(Number(report.actual_other_cost))}</td></tr>` : ""}
      <tr class="total-row">
        <td colspan="3" style="text-align:right;padding-right:12px;"><strong>实际合计</strong></td>
        <td class="right">${formatMoney(Number(report.actual_total))}</td>
      </tr>
    </tbody>
  </table>

  <div class="section-header">费用对比</div>
  <table class="data-table">
    <thead><tr><th>项目</th><th class="right" style="width:120px;">金额 ($)</th></tr></thead>
    <tbody>
      <tr><td>原始报价</td><td class="right">${quote ? formatMoney(Number(quote.total)) : "—"}</td></tr>
      <tr><td>实际费用</td><td class="right">${formatMoney(Number(report.actual_total))}</td></tr>
      <tr><td><strong>差额</strong></td><td class="right" style="color: ${quote ? (Number(report.actual_total) - Number(quote.total) > 0 ? '#c00' : Number(report.actual_total) - Number(quote.total) < 0 ? '#080' : 'inherit') : 'inherit'}"><strong>${quote ? ((v) => (v > 0 ? '+' : '') + formatMoney(v))(Number(report.actual_total) - Number(quote.total)) : "—"}</strong></td></tr>
    </tbody>
  </table>

  ${report.recommendations ? `
  <div class="section-header">维修建议</div>
  <div class="text-block">${escapeHtml(report.recommendations as string)}</div>` : ""}

  ${buildTimelineHTML(history)}

  <div class="sig-section">
    <div class="sig-row">
      <div class="sig-item">
        <div class="sig-label">维修师傅签字:</div>
        <div class="sig-line"></div>
        <div class="sig-date">日期: _______________</div>
      </div>
      <div class="sig-item">
        <div class="sig-label">业主确认:</div>
        <div class="sig-line"></div>
        <div class="sig-date">日期: _______________</div>
      </div>
    </div>
  </div>

  ${buildFooter(docNo)}
</body>
</html>`;
}
