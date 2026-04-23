import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./token";

export interface PublicAuthResult {
  workOrderId: string;
  role: string;
  actorId: string;
}

// Verify token from query param or header for public (non-login) pages
export function getPublicAuth(request: NextRequest): PublicAuthResult | null {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") || request.headers.get("x-access-token");
  if (!token) return null;
  return verifyToken(token);
}

export function publicUnauthorizedResponse() {
  return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
}
