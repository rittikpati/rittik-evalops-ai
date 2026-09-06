import { NextRequest, NextResponse } from "next/server";
import { runsRepository } from "@/lib/runs/repository";
import { experimentRepository } from "@/lib/experiments/repository";
import { requireCurrentUser } from "@/lib/auth/api";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCurrentUser(request);
  if (auth.response) return auth.response;
  const { id } = await params;
  // Runs only exist for this user or never exist — safe 404 for foreign experiments.
  if (!(await experimentRepository.getExperiment(id, auth.user.id))) {
    return NextResponse.json({ status: "error", error: "EXPERIMENT_NOT_FOUND" }, { status: 404 });
  }
  const runs = await runsRepository.getRunsByExperiment(id, auth.user.id);
  return NextResponse.json({ status: "success", runs }, { status: 200 });
}