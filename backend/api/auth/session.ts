import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, UNAUTHENTICATED_RESPONSE } from "@/lib/auth/api";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return UNAUTHENTICATED_RESPONSE();
  return NextResponse.json({ status: "success", user }, { status: 200 });
}