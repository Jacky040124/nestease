// Email sending via Resend — used for owner notifications with rich content

import { escapeHtml, formatMoney } from "@/lib/utils";

export async function sendApprovalEmail({
  ownerEmail,
  ownerName,
  address,
  description,
  quoteTotal,
  approveUrl,
}: {
  ownerEmail: string;
  ownerName: string;
  address: string;
  description: string;
  quoteTotal: number;
  approveUrl: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set, skipping approval email");
    return false;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from: "栖安 <onboarding@resend.dev>",
      to: ownerEmail,
      subject: `维修报价审批 — ${escapeHtml(address)}`,
      html: `
        <div style="font-family: -apple-system, 'PingFang SC', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
          <div style="border-bottom: 3px solid #0D9488; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #0D9488; margin: 0;">栖安 NestEase</h2>
            <p style="color: #6B7280; font-size: 13px; margin: 4px 0 0;">维修报价审批通知</p>
          </div>
          <p style="color: #374151;">尊敬的${escapeHtml(ownerName)}：</p>
          <p style="color: #374151;">您的物业 <strong>${escapeHtml(address)}</strong> 有一笔维修需要您审批：</p>
          <div style="background: #F8F9FA; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px; color: #6B7280; font-size: 13px;"><strong>问题描述：</strong>${escapeHtml(description)}</p>
            <p style="margin: 0; font-size: 20px; font-weight: 700; color: #0D9488;">${formatMoney(quoteTotal)}</p>
          </div>
          <a href="${approveUrl}" style="display: inline-block; background: #0D9488; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 8px 0;">查看详情并审批</a>
          <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">此邮件由栖安系统自动发送</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error("[email] Failed to send approval email:", err);
    return false;
  }
}

export async function sendCompletionEmail({
  ownerEmail,
  ownerName,
  address,
  description,
  actualTotal,
  pdfUrl,
}: {
  ownerEmail: string;
  ownerName: string;
  address: string;
  description: string;
  actualTotal: number;
  pdfUrl: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set, skipping completion email");
    return false;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from: "栖安 <onboarding@resend.dev>",
      to: ownerEmail,
      subject: `维修完成通知 — ${escapeHtml(address)}`,
      html: `
        <div style="font-family: -apple-system, 'PingFang SC', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
          <div style="border-bottom: 3px solid #0D9488; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #0D9488; margin: 0;">栖安 NestEase</h2>
            <p style="color: #6B7280; font-size: 13px; margin: 4px 0 0;">维修完成通知</p>
          </div>
          <p style="color: #374151;">尊敬的${escapeHtml(ownerName)}：</p>
          <p style="color: #374151;">您的物业 <strong>${escapeHtml(address)}</strong> 的维修已完成：</p>
          <div style="background: #F0FDF4; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #BBF7D0;">
            <p style="margin: 0 0 8px; color: #166534; font-size: 13px;"><strong>问题：</strong>${escapeHtml(description)}</p>
            <p style="margin: 0; color: #166534; font-weight: 600;">实际费用：${formatMoney(actualTotal)}</p>
          </div>
          <a href="${pdfUrl}" style="display: inline-block; background: #0D9488; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 8px 0;">查看完工报告</a>
          <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">此邮件由栖安系统自动发送</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error("[email] Failed to send completion email:", err);
    return false;
  }
}
