import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { signContractorSession } from "@/lib/contractor-session";

// POST /api/auth/contractor/verify-otp — Login with OTP
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { phone, code } = body;

  if (!phone || typeof phone !== "string" || phone.trim().length < 5) {
    return NextResponse.json({ error: "请输入有效的手机号" }, { status: 422 });
  }
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "验证码为必填项" }, { status: 400 });
  }

  const normalizedPhone = phone.trim();

  // ── Check registration FIRST (before consuming OTP) ────
  const { data: contractor } = await supabaseAdmin
    .from("contractor")
    .select("id, name, auth_id")
    .eq("phone", normalizedPhone)
    .single();

  if (!contractor || !contractor.auth_id) {
    return NextResponse.json(
      { error: "该手机号未注册，请先通过 PM Code 注册" },
      { status: 404 }
    );
  }

  // ── Verify OTP ──────────────────────────────────────────
  const now = new Date().toISOString();
  const { data: otpRecords } = await supabaseAdmin
    .from("contractor_otp")
    .select("*")
    .eq("phone", normalizedPhone)
    .eq("used", false)
    .gt("expires_at", now);

  const validOtp = (otpRecords || []).find(
    (o: Record<string, unknown>) =>
      (o.attempts as number) < 5
  );

  if (!validOtp) {
    return NextResponse.json({ error: "验证码无效或已过期" }, { status: 401 });
  }

  // Increment attempts
  await supabaseAdmin
    .from("contractor_otp")
    .update({ attempts: (validOtp.attempts as number) + 1 })
    .eq("id", validOtp.id);

  // Check code match
  if (validOtp.code !== code.trim()) {
    return NextResponse.json({ error: "验证码错误" }, { status: 401 });
  }

  // Mark OTP as used
  await supabaseAdmin
    .from("contractor_otp")
    .update({ used: true })
    .eq("id", validOtp.id);

  // ── Return session ──────────────────────────────────────
  const accessToken = signContractorSession(contractor.auth_id);
  return NextResponse.json({
    session: { access_token: accessToken },
    contractor: { id: contractor.id, name: contractor.name },
  });
}
