import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { canAccess } from "@/lib/access";
import type { Role } from "@/lib/types";

const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET ?? "");

async function readRole(token: string | undefined): Promise<Role | null> {
  if (!token || !process.env.JWT_ACCESS_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return (payload.role as Role) ?? null;
  } catch {
    return null;
  }
}

/**
 * Route guard. Runs before protected pages render:
 *  - no/invalid access token + refresh cookie → refresh via the API, then come back
 *  - no session at all → /login?redirect=…
 *  - wrong role → /dashboard (with a notice)
 *  - signed-in users visiting /login or /register → /dashboard
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const role = await readRole(request.cookies.get("access_token")?.value);
  const hasRefresh = request.cookies.has("refresh_token");

  if (pathname === "/login" || pathname === "/register") {
    if (role) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }

  const target = pathname + search;

  if (!role) {
    if (hasRefresh) {
      const url = new URL("/api/auth/refresh", request.url);
      url.searchParams.set("redirect", target);
      return NextResponse.redirect(url);
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", target);
    return NextResponse.redirect(url);
  }

  if (!canAccess(pathname, role)) {
    const url = new URL("/dashboard", request.url);
    url.searchParams.set("denied", "1");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register", "/checkout/:path*"],
};
