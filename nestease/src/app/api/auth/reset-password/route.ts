/**
 * POST /api/auth/reset-password — reset password using token from reset email.
 * Validates token via auth.getUser, then updates password via admin API.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const MIN_PASSWORD_LENGTH = 6;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { access_token, password } = body;

    if (!password) {
      return NextResponse.json({ error: "新密码为必填项" }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `密码至少 ${MIN_PASSWORD_LENGTH} 位` },
        { status: 400 }
      );
    }

    // Verify the reset token by looking up the user
    const { data: { user }, error: authError } =
      await supabaseAdmin.auth.getUser(access_token);

    if (authError || !user) {
      return NextResponse.json({ error: "链接无效或已过期" }, { status: 401 });
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password }
    );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
