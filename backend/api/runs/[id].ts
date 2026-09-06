import { NextRequest, NextResponse } from "next/server";
import { runsRepository } from "@/lib/runs/repository";
import { requireCurrentUser } from "@/lib/auth/api";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCurrentUser(request);
  if (auth.response) return auth.response;
  const { id } = await params;
  const run = await runsRepository.getRun(id, auth.user.id);
  if (!run) return NextResponse.json({ status: "error", error: "RUN_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ status: "success", run }, { status: 200 });
}