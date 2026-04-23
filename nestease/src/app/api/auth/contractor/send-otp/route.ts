import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSMS } from "@/lib/sms";

// POST /api/auth/contractor/send-otp — Send 6-digit OTP via SMS
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { phone } = body;

  if (!phone || typeof phone !== "string" || phone.trim().length < 5) {
    return NextResponse.json({ error: "请输入有效的手机号" }, { status: 422 });
  }

  const normalizedPhone = phone.trim();

  // Rate limit: 60 seconds between OTPs for the same phone
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const { data: recentOtps } = await supabaseAdmin
    .from("contractor_otp")
    .select("id")
    .eq("phone", normalizedPhone)
    .gt("created_at", cutoff);

  if (recentOtps && recentOtps.length > 0) {
    return NextResponse.json(
      { error: "请等待 60 秒后再试" },
      { status: 429 }
    );
  }

  // Clean up expired OTPs (older than 1 day)
  const expiryCutoff = new Date(Date.now() - 86400_000).toISOString();
  await supabaseAdmin
    .from("contractor_otp")
    .delete()
    .lt("expires_at", expiryCutoff);

  // Generate 6-digit OTP
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // Store OTP (5 minute expiry)
  await supabaseAdmin.from("contractor_otp").insert({
    phone: normalizedPhone,
    code,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    attempts: 0,
    used: false,
  });

  // Send SMS (always send, don't check if phone exists — anti-enumeration)
  await sendSMS(normalizedPhone, `您的栖安验证码是：${code}，5分钟内有效。`);

  return NextResponse.json({ success: true });
}
