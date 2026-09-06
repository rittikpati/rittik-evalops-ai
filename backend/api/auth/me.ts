import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from "@/lib/auth/token";
import { requireCurrentUser, sessionCookieOptions } from "@/lib/auth/api";
import { emailExists, updateUserProfile } from "@/lib/auth/users";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PATCH /api/auth/me — updates the authenticated user's profile (name/email).
 * The session cookie is re-issued so the signed payload always matches the DB.
 * Email uniqueness is enforced against every other registered account.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const user = auth.user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Malformed JSON", code: "INVALID_JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" && b.name.trim() ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";

  if (!name) {
    return NextResponse.json({ status: "error", error: "Name is required", code: "VALIDATION" }, { status: 400 });
  }
  if (name.length > 80) {
    return NextResponse.json({ status: "error", error: "Name must be 80 characters or fewer", code: "VALIDATION" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ status: "error", error: "Invalid email format", code: "VALIDATION" }, { status: 400 });
  }

  // Uniqueness: another account (not this one) already owns the normalized email.
  if (email !== user.email && (await emailExists(email))) {
    return NextResponse.json(
      { status: "error", error: "This email is already registered to another account", code: "DUPLICATE_EMAIL" },
      { status: 409 }
    );
  }

  const updated = await updateUserProfile(user.id, { name, email });
  if (!updated) {
    return NextResponse.json({ status: "error", error: "Account not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const token = signSession(updated);
  const res = NextResponse.json(
    { status: "success", user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role } },
    { status: 200 }
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(req, SESSION_MAX_AGE_SECONDS));
  return res;
}