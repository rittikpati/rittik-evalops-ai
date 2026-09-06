import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

const UNAUTHENTICATED_JSON = () =>
  NextResponse.json(
    { status: "error", error: "Authentication required", code: "UNAUTHENTICATED" },
    { status: 401 }
  );

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth endpoints handle their own session logic (login/logout/session).
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const payload = token ? verifySession(token) : null;

  if (payload) return NextResponse.next();

  if (pathname.startsWith("/api")) return UNAUTHENTICATED_JSON();

const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}
