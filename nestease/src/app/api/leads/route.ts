import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { escapeHtml } from "@/lib/utils";

async function sendLeadNotification(name: string, wechatId: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[leads] RESEND_API_KEY not set, skipping email notification");
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from: "栖安 <onboarding@resend.dev>",
      to: process.env.LEAD_NOTIFICATION_EMAIL || "admin@example.com",
      subject: `新客户咨询 — ${escapeHtml(name)}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0D9488; margin-bottom: 16px;">栖安 — 新客户咨询</h2>
          <div style="background: #F8F9FA; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <p style="margin: 0 0 8px;"><strong>姓名：</strong>${escapeHtml(name)}</p>
            <p style="margin: 0;"><strong>微信号：</strong>${escapeHtml(wechatId)}</p>
          </div>
          <p style="color: #6B7280; font-size: 14px;">请尽快通过微信联系该客户。</p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 16px 0;" />
          <p style="color: #9CA3AF; font-size: 12px;">此邮件由栖安系统自动发送</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[leads] Failed to send email notification:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, wechat_id } = body;

    if (!name || !wechat_id) {
      return NextResponse.json({ error: "姓名和微信号为必填项" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("leads")
      .insert({ name, wechat_id });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send email notification (awaited to prevent serverless early termination)
    await sendLeadNotification(name, wechat_id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
