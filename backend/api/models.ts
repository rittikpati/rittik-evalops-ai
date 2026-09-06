import { NextRequest, NextResponse } from "next/server";
import { modelRegistry } from "@/lib/ai/models";
import { requireCurrentUser } from "@/lib/auth/api";
import { getModelEnabledMap } from "@/lib/models/toggles";
import {
  customModelRepository,
  customModelToConfig,
  DuplicateModelError,
} from "@/lib/models/custom";

const NAME_MAX = 80;
const PROVIDER_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,29}$/;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export async function GET(req: NextRequest) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  // Built-in registry + this user's custom models, each merged with toggles.
  const [enabledMap, customRows] = await Promise.all([
    getModelEnabledMap(auth.user.id),
    customModelRepository.getCustomModels(auth.user.id),
  ]);
  const registryModels = modelRegistry.map((m) => ({
    ...m,
    custom: false,
    enabled: enabledMap.get(m.id) ?? true,
  }));
  const customModels = customRows.map((row) => ({
    ...customModelToConfig(row),
    custom: true,
    enabled: enabledMap.get(row.modelId) ?? true,
  }));
  return NextResponse.json(
    { status: "success", models: [...registryModels, ...customModels] },
    { status: 200 }
  );
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
  const b = (body ?? {}) as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name : "";
  if (!name.trim()) {
    return NextResponse.json({ status: "error", error: "Model name is required", code: "NAME_REQUIRED" }, { status: 400 });
  }
  if (name.trim().length > NAME_MAX) {
    return NextResponse.json({ status: "error", error: `Name must be ${NAME_MAX} characters or fewer`, code: "NAME_TOO_LONG" }, { status: 400 });
  }

  const provider = typeof b.provider === "string" ? b.provider.trim() : "";
  if (!provider) {
    return NextResponse.json({ status: "error", error: "Provider is required", code: "PROVIDER_REQUIRED" }, { status: 400 });
  }
  if (!PROVIDER_RE.test(provider)) {
    return NextResponse.json({ status: "error", error: "Provider must be 1-30 letters/numbers/hyphens", code: "INVALID_PROVIDER" }, { status: 400 });
  }

  const description = b.description === undefined ? undefined : String(b.description);
  if (description !== undefined && description.length > 2000) {
    return NextResponse.json({ status: "error", error: "Description must be 2000 characters or fewer", code: "DESCRIPTION_TOO_LONG" }, { status: 400 });
  }

  const contextLength = b.contextLength === undefined ? undefined : Number(b.contextLength);
  if (contextLength !== undefined && (!isFiniteNumber(contextLength) || contextLength < 1 || contextLength > 4_000_000)) {
    return NextResponse.json({ status: "error", error: "Context length must be between 1 and 4,000,000", code: "INVALID_CONTEXT_LENGTH" }, { status: 400 });
  }

  const maxOutputTokens = b.maxOutputTokens === undefined ? undefined : Number(b.maxOutputTokens);
  if (maxOutputTokens !== undefined && (!isFiniteNumber(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 1_000_000)) {
    return NextResponse.json({ status: "error", error: "Max output tokens must be between 1 and 1,000,000", code: "INVALID_MAX_TOKENS" }, { status: 400 });
  }

  const pricingPrompt = b.pricingPrompt === undefined ? undefined : Number(b.pricingPrompt);
  if (pricingPrompt !== undefined && (!isFiniteNumber(pricingPrompt) || pricingPrompt < 0)) {
    return NextResponse.json({ status: "error", error: "Prompt price must be 0 or more", code: "INVALID_PRICING" }, { status: 400 });
  }
  const pricingCompletion = b.pricingCompletion === undefined ? undefined : Number(b.pricingCompletion);
  if (pricingCompletion !== undefined && (!isFiniteNumber(pricingCompletion) || pricingCompletion < 0)) {
    return NextResponse.json({ status: "error", error: "Completion price must be 0 or more", code: "INVALID_PRICING" }, { status: 400 });
  }

  let capabilities: string[] | undefined;
  if (b.capabilities !== undefined) {
    if (!Array.isArray(b.capabilities) || b.capabilities.some((c) => typeof c !== "string")) {
      return NextResponse.json({ status: "error", error: "Capabilities must be a list of strings", code: "INVALID_CAPABILITIES" }, { status: 400 });
    }
    capabilities = (b.capabilities as string[]).map((c) => c.trim()).filter(Boolean).slice(0, 12);
  }

  const openRouterId = b.openRouterId === undefined ? undefined : String(b.openRouterId);
  if (openRouterId !== undefined && openRouterId.length > 200) {
    return NextResponse.json({ status: "error", error: "OpenRouter ID must be 200 characters or fewer", code: "OPENROUTER_ID_TOO_LONG" }, { status: 400 });
  }

  try {
    const row = await customModelRepository.createModel(auth.user.id, {
      name,
      provider,
      description,
      version: b.version === undefined ? undefined : String(b.version).slice(0, 50),
      contextLength,
      maxOutputTokens,
      pricingPrompt,
      pricingCompletion,
      capabilities,
      openRouterId,
    });
    return NextResponse.json(
      { status: "success", model: { ...customModelToConfig(row), custom: true, enabled: true } },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof DuplicateModelError) {
      return NextResponse.json({ status: "error", error: err.message, code: "DUPLICATE_MODEL" }, { status: 409 });
    }
    throw err;
  }
}