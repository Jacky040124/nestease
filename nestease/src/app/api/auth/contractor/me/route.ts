import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getContractorId } from "@/lib/auth";

// GET /api/auth/contractor/me — Get current contractor info + pending work orders
export async function GET(request: NextRequest) {
  try {
    const contractorId = await getContractorId(request);
    if (!contractorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch contractor info
    const { data: contractor, error } = await supabaseAdmin
      .from("contractor")
      .select("id, name, phone, specialties, pm_id, registered_at")
      .eq("id", contractorId)
      .single();

    if (error || !contractor) {
      return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
    }

    // Fetch pending work orders (assigned or in_progress status)
    const { data: workOrders } = await supabaseAdmin
      .from("work_order")
      .select("id, status, property_address, category, created_at")
      .eq("contractor_id", contractorId)
      .in("status", ["assigned", "quoting", "in_progress", "pending_verification"]);

    return NextResponse.json({
      contractor,
      pending_work_orders: workOrders || [],
    });
  } catch (err) {
    console.error("contractor/me error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
