import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, invalidateUserCache } from "@/lib/auth/users";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from "@/lib/auth/token";
import { sessionCookieOptions } from "@/lib/auth/api";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Malformed JSON", code: "INVALID_JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (!name) {
    return NextResponse.json({ status: "error", error: "Name is required", code: "VALIDATION" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ status: "error", error: "Valid email is required", code: "VALIDATION" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ status: "error", error: "Password must be at least 8 characters", code: "VALIDATION" }, { status: 400 });
  }

  const db = getDb();

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ status: "error", error: "Email already registered", code: "DUPLICATE_EMAIL" }, { status: 409 });
  }

  const id = `user_${randomUUID().slice(0, 12)}`;
  const passwordHash = hashPassword(password);

  const [user] = await db
    .insert(users)
    .values({
      id,
      name,
      email,
      role: "member",
      passwordHash,
    })
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role });

  invalidateUserCache(user.id);

  const token = signSession({ id: user.id, name: user.name, email: user.email, role: user.role });
  const res = NextResponse.json(
    { status: "success", user: { id: user.id, name: user.name, email: user.email, role: user.role } },
    { status: 201 }
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(req, SESSION_MAX_AGE_SECONDS));
  return res;
}