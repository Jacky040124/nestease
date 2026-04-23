/**
 * POST /api/auth/register — PM self-registration.
 * Creates a Supabase auth user + PM table record.
 * Returns user, pm, and session for auto-login.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, phone } = body;

    // ── Validation ──────────────────────────────────────────
    if (!email) {
      return NextResponse.json({ error: "邮箱为必填项" }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: "密码为必填项" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "姓名为必填项" }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "手机号为必填项" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "邮箱格式无效" }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `密码至少 ${MIN_PASSWORD_LENGTH} 位` },
        { status: 400 }
      );
    }

    // ── Create auth user ────────────────────────────────────
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) {
      // Supabase returns 422 for duplicate email
      if (authError.status === 422 || authError.message?.includes("already")) {
        return NextResponse.json({ error: "邮箱已注册" }, { status: 409 });
      }
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    const authUser = authData.user;

    // ── Generate unique PM Code ─────────────────────────────
    let pmCode: string;
    let codeExists = true;
    do {
      pmCode = Array.from({ length: 6 }, () =>
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]
      ).join("");
      const { data: existing } = await supabaseAdmin
        .from("pm")
        .select("id")
        .eq("pm_code", pmCode)
        .maybeSingle();
      codeExists = !!existing;
    } while (codeExists);

    // ── Create PM record ────────────────────────────────────
    const { data: pmData, error: pmError } = await supabaseAdmin
      .from("pm")
      .insert({
        auth_id: authUser.id,
        name,
        email,
        phone: phone || null,
        pm_code: pmCode,
      })
      .select()
      .single();

    if (pmError) {
      console.error("PM insert failed:", pmError);
      // Rollback: delete orphaned auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      return NextResponse.json(
        { error: `创建 PM 记录失败: ${pmError.message}` },
        { status: 500 }
      );
    }

    // Return user + pm info; client calls signInWithPassword for auto-login
    return NextResponse.json(
      {
        user: { id: authUser.id, email: authUser.email },
        pm: pmData,
        session: { access_token: authUser.id },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
