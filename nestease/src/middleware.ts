/**
 * Next.js Middleware — server-side route protection.
 * Redirects unauthenticated users away from /dashboard/*,
 * and authenticated users away from /login.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/login/contractor",
  "/register",
  "/register/contractor",
  "/repair",
  "/status",
  "/approve",
  "/verify",
  "/forgot-password",
  "/reset-password",
];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  // All contractor API routes — auth handled by route handlers via getContractorId()
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect old /quote and /completion-report to contractor login
  if (pathname === "/quote" || pathname === "/completion-report") {
    const url = new URL("/login/contractor", request.url);
    // Preserve work order ID for post-login redirect
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const target = pathname === "/quote"
        ? `/contractor/quote/${id}`
        : `/contractor/completion-report/${id}`;
      url.searchParams.set("redirect", target);
    }
    return NextResponse.redirect(url);
  }

  // Public routes — pass through without auth check
  if (isPublicRoute(pathname)) {
    // Exception: /login with valid session → redirect to dashboard
    if (pathname === "/login") {
      const user = await getUser(request);
      if (user) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
    return NextResponse.next();
  }

  // Contractor protected routes — check contractor session via cookie/token
  if (pathname.startsWith("/contractor/")) {
    // For now, contractor auth is handled client-side via localStorage token
    // Middleware passes through; pages check auth on mount
    return NextResponse.next();
  }

  // PM protected routes — require valid session
  const user = await getUser(request);
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

async function getUser(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // Middleware can't set cookies directly; handled by response
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
