import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, verifySession } from "./token";
import { getUserById } from "./users";
import type { SessionUser } from "./users";

export type { SessionUser, AuthRole } from "./users";

export type AuthResult =
  | { user: SessionUser; response: null }
  | { user: null; response: NextResponse };

/**
 * Cookie options for the session cookie. `secure` is derived from the actual
 * connection (or x-forwarded-proto behind a TLS proxy) so the cookie works over
 * plain http://localhost while remaining Secure when served over HTTPS.
 */
export function sessionCookieOptions(req: NextRequest, maxAge: number) {
  const secure =
    req.nextUrl.protocol === "https:" || (req.headers.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge,
  };
}

/** 401 body returned by protected routes. */
export const UNAUTHENTICATED_RESPONSE = () =>
  NextResponse.json(
    { status: "error", error: "Authentication required", code: "UNAUTHENTICATED" },
    { status: 401 }
  );

/** Resolves the current user from the session cookie, or null when absent/invalid. */
export async function getCurrentUser(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = token ? verifySession(token) : null;
  if (!payload) return null;
  // Re-validate against the store so removed users are immediately logged out.
  const user = await getUserById(payload.sub);
  return user;
}

/**
 * Requires an authenticated user. Typical handler pattern:
 *   const auth = await requireCurrentUser(req);
 *   if (auth.response) return auth.response;
 *   const user = auth.user;
 */
export async function requireCurrentUser(req: NextRequest): Promise<AuthResult> {
  const user = await getCurrentUser(req);
  if (!user) return { user: null, response: UNAUTHENTICATED_RESPONSE() };
  return { user, response: null };
}