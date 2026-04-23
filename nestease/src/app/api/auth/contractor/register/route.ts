import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { signContractorSession } from "@/lib/contractor-session";

// POST /api/auth/contractor/register — Register new contractor with PM Code + OTP
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { pm_code, name, phone, specialties, otp } = body;

  // ── Validation ──────────────────────────────────────────
  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "姓名为必填项" }, { status: 422 });
  }
  if (!specialties || !Array.isArray(specialties) || specialties.length === 0) {
    return NextResponse.json({ error: "请至少选择一个专长" }, { status: 422 });
  }
  if (!phone || typeof phone !== "string" || phone.trim().length < 5) {
    return NextResponse.json({ error: "请输入有效的手机号" }, { status: 422 });
  }
  if (!pm_code || typeof pm_code !== "string") {
    return NextResponse.json({ error: "PM Code 为必填项" }, { status: 400 });
  }
  if (!otp || typeof otp !== "string") {
    return NextResponse.json({ error: "验证码为必填项" }, { status: 400 });
  }

  const normalizedPhone = phone.trim();

  // ── Verify PM Code ──────────────────────────────────────
  const { data: pm } = await supabaseAdmin
    .from("pm")
    .select("id, name")
    .eq("pm_code", pm_code.trim().toUpperCase())
    .single();

  if (!pm) {
    return NextResponse.json({ error: "无效的 PM Code" }, { status: 400 });
  }

  // ── Check phone not already registered under this PM ────
  const { data: existing } = await supabaseAdmin
    .from("contractor")
    .select("id, auth_id")
    .eq("phone", normalizedPhone)
    .eq("pm_id", pm.id)
    .maybeSingle();

  if (existing && existing.auth_id) {
    return NextResponse.json({ error: "该手机号已在此物业经理下注册" }, { status: 409 });
  }

  // ── Verify OTP ──────────────────────────────────────────
  const now = new Date().toISOString();
  const { data: otpRecords } = await supabaseAdmin
    .from("contractor_otp")
    .select("*")
    .eq("phone", normalizedPhone)
    .eq("used", false)
    .gt("expires_at", now);

  // Find valid OTP with attempts < 5
  const validOtp = (otpRecords || []).find(
    (o: Record<string, unknown>) =>
      (o.attempts as number) < 5
  );

  if (!validOtp) {
    // Check if there's an OTP with too many attempts
    const exhausted = (otpRecords || []).find(
      (o: Record<string, unknown>) => (o.attempts as number) >= 5
    );
    if (exhausted) {
      return NextResponse.json({ error: "验证码尝试次数过多，请重新获取" }, { status: 429 });
    }
    return NextResponse.json({ error: "验证码无效或已过期" }, { status: 401 });
  }

  // Increment attempts
  await supabaseAdmin
    .from("contractor_otp")
    .update({ attempts: (validOtp.attempts as number) + 1 })
    .eq("id", validOtp.id);

  // Check code match
  if (validOtp.code !== otp.trim()) {
    return NextResponse.json({ error: "验证码错误" }, { status: 401 });
  }

  // Mark OTP as used
  await supabaseAdmin
    .from("contractor_otp")
    .update({ used: true })
    .eq("id", validOtp.id);

  // ── Find or create Supabase auth user ───────────────────
  // A contractor may already have an auth user from registering under another PM
  let authUser;
  let createdNewAuthUser = false;

  // Check if an auth user with this phone already exists (via another PM's contractor record)
  const { data: existingContractorWithAuth } = await supabaseAdmin
    .from("contractor")
    .select("auth_id")
    .eq("phone", normalizedPhone)
    .not("auth_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (existingContractorWithAuth?.auth_id) {
    // Reuse existing auth user
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(existingContractorWithAuth.auth_id);
    if (!user) {
      return NextResponse.json({ error: "创建账号失败" }, { status: 500 });
    }
    authUser = user;
  } else {
    // Create new auth user
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        phone: normalizedPhone,
        phone_confirm: true,
        user_metadata: { role: "contractor" },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "创建账号失败" },
        { status: 500 }
      );
    }
    authUser = authData.user;
    createdNewAuthUser = true;
  }

  // ── Create or update contractor record ──────────────────
  const contractorData = {
    name: name.trim(),
    phone: normalizedPhone,
    specialties,
    pm_id: pm.id,
    auth_id: authUser.id,
    registered_at: new Date().toISOString(),
  };

  let contractor;
  if (existing) {
    // Update existing contractor record (was added by PM before, now registering)
    const { data, error } = await supabaseAdmin
      .from("contractor")
      .update(contractorData)
      .eq("id", existing.id)
      .select()
      .single();
    if (error || !data) {
      // Only rollback auth user if we created it (don't delete shared auth users)
      if (createdNewAuthUser) await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      return NextResponse.json({ error: "注册失败" }, { status: 500 });
    }
    contractor = data;
  } else {
    // Insert new contractor
    const { data, error } = await supabaseAdmin
      .from("contractor")
      .insert(contractorData)
      .select()
      .single();
    if (error || !data) {
      // Only rollback auth user if we created it (don't delete shared auth users)
      if (createdNewAuthUser) await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      return NextResponse.json({ error: "注册失败" }, { status: 500 });
    }
    contractor = data;
  }

  // ── Return session ──────────────────────────────────────
  const accessToken = signContractorSession(authUser.id);
  return NextResponse.json(
    {
      session: { access_token: accessToken },
      contractor: { id: contractor.id, name: contractor.name },
    },
    { status: 201 }
  );
}
