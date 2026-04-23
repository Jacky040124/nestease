import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, AuthUser } from "@/lib/auth";

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * Wraps an authenticated route handler.
 * Rejects with 401 if no valid auth; otherwise injects `user` as first arg.
 */
export function withAuth<T extends unknown[]>(
  handler: (user: AuthUser, request: NextRequest, ...args: T) => Promise<NextResponse>,
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(user, request, ...args);
  };
}

/**
 * Wraps an authenticated route handler that has route params.
 */
export function withAuthParams(
  handler: (user: AuthUser, request: NextRequest, ctx: RouteContext) => Promise<NextResponse>,
) {
  return async (request: NextRequest, ctx: RouteContext): Promise<NextResponse> => {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(user, request, ctx);
  };
}
