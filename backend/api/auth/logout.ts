import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/token";
import { sessionCookieOptions } from "@/lib/auth/api";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ status: "success" });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(req, 0));
  return res;
}