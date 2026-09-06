import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "evalops_session";

/** Session lifetime: 7 days. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * Development-only fallback. If AUTH_SECRET is unset we still want the app to
 * work locally, but this constant is NOT safe to ship to production.
 */
const DEV_FALLBACK_SECRET = "dev-only-evalops-session-secret-2f3a9c17";

function getSecret(): string {
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    throw new Error(
      "AUTH_SECRET is required in production. Set AUTH_SECRET in your deployment environment. It must be a long random string (e.g., 32+ chars)."
    );
  }

  console.warn(
    "[RittikEvalOpsAI] AUTH_SECRET not set â€” using development fallback. Set AUTH_SECRET in .env.local for production-like security."
  );
  return DEV_FALLBACK_SECRET;
}

export type SessionRole = "admin" | "member";

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: SessionRole;
  iat: number;
  exp: number;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

const TOKEN_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** Creates a signed, non-extractable session token for the given user. */
export function signSession(user: {
  id: string;
  email: string;
  name: string;
  role: SessionRole;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function signatureValid(token: string): boolean {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const encoded = token.slice(0, dot);
  const expected = createHmac("sha256", getSecret()).update(encoded).digest();
  try {
    const provided = Buffer.from(token.slice(dot + 1), "base64url");
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}

/**
 * Verifies the token signature and expiry. Returns null for any token that is
 * malformed, tampered with, or expired. The type narrowing on `payload.role`
 * keeps authentication data honest (UserStatus / role changes are not
 * honoured by tampered tokens).
 */
export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token || !TOKEN_RE.test(token)) return null;
  if (!signatureValid(token)) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(token.slice(0, token.lastIndexOf(".")))) as Partial<SessionPayload>;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      (payload.role !== "admin" && payload.role !== "member") ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}