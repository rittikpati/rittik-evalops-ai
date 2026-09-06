import { NextRequest, NextResponse } from "next/server";
import { experimentRepository, type ExperimentRecord } from "@/lib/experiments/repository";
import { runsRepository } from "@/lib/runs/repository";
import { getModelById } from "@/lib/ai/models";
import { requireCurrentUser } from "@/lib/auth/api";
import { resolveUserModel } from "@/lib/models/custom";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const { id } = await params;
  const exp = await experimentRepository.getExperiment(id, auth.user.id);
  if (!exp) return NextResponse.json({ status: "error", error: "EXPERIMENT_NOT_FOUND" }, { status: 404 });
  const runs = await runsRepository.getRunsByExperiment(id, auth.user.id);
  return NextResponse.json({ status: "success", experiment: exp, runs }, { status: 200 });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Malformed JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  // Whitelist of client-editable fields. status/datasetId/models are NOT
  // client-editable (they are lifecycle/ownership-driven).
  const patch: Record<string, unknown> = {};

  if (b.name !== undefined) {
    const name = String(b.name);
    if (!name.trim()) return NextResponse.json({ status: "error", error: "NAME_REQUIRED", code: "NAME_REQUIRED" }, { status: 400 });
    if (name.trim().length > 200) return NextResponse.json({ status: "error", error: "NAME_TOO_LONG", code: "NAME_TOO_LONG" }, { status: 400 });
    patch.name = name.trim();
  }
  if (b.description !== undefined) {
    const description = String(b.description);
    if (description.length > 2000) return NextResponse.json({ status: "error", error: "DESCRIPTION_TOO_LONG", code: "DESCRIPTION_TOO_LONG" }, { status: 400 });
    patch.description = description.trim();
  }
  if (b.promptTemplate !== undefined) {
    const promptTemplate = String(b.promptTemplate);
    if (!/{{(question|input)}}/.test(promptTemplate)) {
      return NextResponse.json({ status: "error", error: "PROMPT_TEMPLATE_INVALID", code: "PROMPT_TEMPLATE_INVALID", message: "Prompt template must include the {{question}} placeholder." }, { status: 400 });
    }
    patch.promptTemplate = promptTemplate;
  }
  if (b.systemPrompt !== undefined) {
    const systemPrompt = String(b.systemPrompt);
    if (systemPrompt.length > 20000) return NextResponse.json({ status: "error", error: "SYSTEM_PROMPT_TOO_LONG", code: "SYSTEM_PROMPT_TOO_LONG" }, { status: 400 });
    patch.systemPrompt = systemPrompt;
  }
  if (b.temperature !== undefined) {
    const temperature = typeof b.temperature === "number" ? b.temperature : Number(b.temperature);
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      return NextResponse.json({ status: "error", error: "INVALID_TEMPERATURE", code: "INVALID_TEMPERATURE" }, { status: 400 });
    }
    patch.temperature = temperature;
  }
  if (b.maxTokens !== undefined) {
    const maxTokens = typeof b.maxTokens === "number" ? b.maxTokens : Number(b.maxTokens);
    if (!Number.isFinite(maxTokens) || maxTokens <= 0 || maxTokens > 128000) {
      return NextResponse.json({ status: "error", error: "INVALID_MAX_TOKENS", code: "INVALID_MAX_TOKENS" }, { status: 400 });
    }
    patch.maxTokens = Math.floor(maxTokens);
  }
  if (b.judgeModelId !== undefined) {
    const judgeModelId = String(b.judgeModelId === "" ? "openrouter/free" : b.judgeModelId);
    const judge = getModelById(judgeModelId) ?? (await resolveUserModel(auth.user.id, judgeModelId));
    if (!judge || !judge.openRouterId) {
      return NextResponse.json({ status: "error", error: "JUDGE_MODEL_NOT_FOUND", code: "JUDGE_MODEL_NOT_FOUND" }, { status: 400 });
    }
    patch.judgeModelId = judgeModelId;
  }

  const updated = await experimentRepository.updateExperiment(id, auth.user.id, patch as Partial<ExperimentRecord>);
  if (!updated) return NextResponse.json({ status: "error", error: "EXPERIMENT_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ status: "success", experiment: updated }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const { id } = await params;
  const ok = await experimentRepository.deleteExperiment(id, auth.user.id);
  if (!ok) return NextResponse.json({ status: "error", error: "EXPERIMENT_NOT_FOUND" }, { status: 404 });
  await runsRepository.deleteRunsByExperiment(id, auth.user.id);
  return NextResponse.json({ status: "success" }, { status: 200 });
}