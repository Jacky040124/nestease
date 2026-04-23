import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";

async function getPmByAuthId(authId: string) {
  const { data } = await supabaseAdmin
    .from("pm")
    .select("id, agent_name, agent_avatar, agent_tone")
    .eq("auth_id", authId)
    .single();
  return data;
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pm = await getPmByAuthId(user.id);
  if (!pm) return NextResponse.json({ error: "PM not found" }, { status: 404 });

  return NextResponse.json({ data: pm });
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pm = await getPmByAuthId(user.id);
  if (!pm) return NextResponse.json({ error: "PM not found" }, { status: 404 });

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.agent_name !== undefined) {
    const name = String(body.agent_name).trim();
    if (!name || name.length > 50) {
      return NextResponse.json({ error: "名字不能为空且不超过50字" }, { status: 400 });
    }
    updates.agent_name = name;
  }
  if (body.agent_avatar !== undefined) {
    if (body.agent_avatar && String(body.agent_avatar).length > 2000) {
      return NextResponse.json({ error: "头像配置过长" }, { status: 400 });
    }
    updates.agent_avatar = body.agent_avatar;
  }
  if (body.agent_tone !== undefined) {
    if (!["professional", "friendly", "direct"].includes(body.agent_tone)) {
      return NextResponse.json({ error: "无效的沟通风格" }, { status: 400 });
    }
    updates.agent_tone = body.agent_tone;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "没有要更新的字段" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("pm")
    .update(updates)
    .eq("id", pm.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { ...pm, ...updates } });
}
