import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from "@/lib/auth/token";
import { authenticate } from "@/lib/auth/users";
import { sessionCookieOptions } from "@/lib/auth/api";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Malformed JSON", code: "INVALID_JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (!email.trim() || !password) {
    return NextResponse.json({ status: "error", error: "Email and password are required", code: "VALIDATION" }, { status: 400 });
  }

  const user = await authenticate(email, password);
  if (!user) {
    return NextResponse.json({ status: "error", error: "Invalid email or password", code: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const token = signSession(user);
  const res = NextResponse.json(
    { status: "success", user: { id: user.id, name: user.name, email: user.email, role: user.role } },
    { status: 200 }
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(req, SESSION_MAX_AGE_SECONDS));
  return res;
}