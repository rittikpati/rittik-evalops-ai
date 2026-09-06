import { NextRequest, NextResponse } from "next/server";
import { experimentRepository } from "@/lib/experiments/repository";
import { datasetRepository } from "@/lib/datasets/repository";
import { getModelById } from "@/lib/ai/models";
import { requireCurrentUser } from "@/lib/auth/api";
import { resolveUserModel, resolveUserModels } from "@/lib/models/custom";

export async function GET(req: NextRequest) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const experiments = await experimentRepository.getExperiments(auth.user.id);
  return NextResponse.json({ status: "success", experiments }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Malformed JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const name = b.name as string;
  const datasetId = b.datasetId as string;
  const modelIds = b.modelIds as string[];
  const description = b.description as string | undefined;
  const systemPrompt = b.systemPrompt as string | undefined;
  const promptTemplate = (b.promptTemplate as string) || (b.userPrompt as string) || "Answer {{question}}";
  const temperature = b.temperature as number | undefined;
  const maxTokens = b.maxTokens as number | undefined;
  const judgeModelId = b.judgeModelId as string | undefined;

  if (!name || typeof name !== "string" || !name.trim()) return NextResponse.json({ status: "error", error: "Experiment name required" }, { status: 400 });
  if (name.trim().length > 200) return NextResponse.json({ status: "error", error: "NAME_TOO_LONG" }, { status: 400 });
  if (description && description.length > 2000) return NextResponse.json({ status: "error", error: "DESCRIPTION_TOO_LONG" }, { status: 400 });
  if (!datasetId || typeof datasetId !== "string") return NextResponse.json({ status: "error", error: "datasetId required" }, { status: 400 });
  if (systemPrompt && systemPrompt.length > 20000) return NextResponse.json({ status: "error", error: "SYSTEM_PROMPT_TOO_LONG" }, { status: 400 });
  if (!/{{(question|input)}}/.test(promptTemplate)) {
    return NextResponse.json({ status: "error", error: "PROMPT_TEMPLATE_INVALID", message: "Prompt template must include the {{question}} placeholder." }, { status: 400 });
  }
  if (temperature !== undefined && (!Number.isFinite(temperature) || temperature < 0 || temperature > 2)) {
    return NextResponse.json({ status: "error", error: "INVALID_TEMPERATURE" }, { status: 400 });
  }
  if (maxTokens !== undefined && (!Number.isFinite(maxTokens) || maxTokens <= 0 || maxTokens > 128000)) {
    return NextResponse.json({ status: "error", error: "INVALID_MAX_TOKENS" }, { status: 400 });
  }
  if (judgeModelId !== undefined) {
    const judge = getModelById(judgeModelId) ?? (await resolveUserModel(auth.user.id, judgeModelId));
    if (!judge || !judge.openRouterId) return NextResponse.json({ status: "error", error: "JUDGE_MODEL_NOT_FOUND" }, { status: 400 });
  }
  const ds = await datasetRepository.getDataset(datasetId, auth.user.id);
  if (!ds) return NextResponse.json({ status: "error", error: "DATASET_NOT_FOUND" }, { status: 404 });
  if (!ds.cases || ds.cases.length === 0) return NextResponse.json({ status: "error", error: "NO_TEST_CASES" }, { status: 400 });
  if (!Array.isArray(modelIds) || modelIds.length === 0) return NextResponse.json({ status: "error", error: "modelIds required" }, { status: 400 });
  for (const id of modelIds) {
    const m = getModelById(id) ?? (await resolveUserModel(auth.user.id, id));
    if (!m) return NextResponse.json({ status: "error", error: `MODEL_NOT_FOUND: ${id}`, code: "MODEL_NOT_FOUND" }, { status: 400 });
    if (!m.openRouterId || !m.openRouterId.trim()) return NextResponse.json({ status: "error", error: `MODEL_NOT_CONFIGURED: ${id}`, code: "MODEL_NOT_CONFIGURED" }, { status: 400 });
  }
  const models = await resolveUserModels(auth.user.id, modelIds);

  const exp = await experimentRepository.createExperiment({
    ownerId: auth.user.id,
    name: name.trim(),
    description: description?.trim(),
    datasetId,
    datasetName: ds.name,
    models: modelIds,
    modelNames: models.map((m) => m!.displayName),
    promptTemplate,
    systemPrompt,
    temperature,
    maxTokens,
    judgeModelId,
    status: "draft",
    totalTestCases: ds.cases.length * modelIds.length,
    completedTestCases: 0,
    progress: 0,
  });

  return NextResponse.json({ status: "success", experiment: exp }, { status: 201 });
}