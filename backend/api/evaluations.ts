import { NextRequest, NextResponse } from "next/server";
import { runsRepository } from "@/lib/runs/repository";
import { requireCurrentUser } from "@/lib/auth/api";

export async function GET(req: NextRequest) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const runs = await runsRepository.getRuns(auth.user.id);
  return NextResponse.json({ status: "success", runs }, { status: 200 });
}