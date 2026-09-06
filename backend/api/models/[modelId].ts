import { NextRequest, NextResponse } from "next/server";
import { modelRegistry } from "@/lib/ai/models";
import { requireCurrentUser } from "@/lib/auth/api";
import { setModelEnabled, deleteModelToggle } from "@/lib/models/toggles";
import { customModelRepository, customModelToConfig } from "@/lib/models/custom";

/** Finds a model by id/slug across the registry and the user's custom models. */
async function findUserModel(ownerId: string, id: string) {
  const builtIn = modelRegistry.find((m) => m.id === id || m.slug === id);
  if (builtIn) return { config: builtIn, custom: false };
  const rows = await customModelRepository.getCustomModels(ownerId);
  const row = rows.find((c) => c.modelId === id || c.slug === id);
  return row ? { config: customModelToConfig(row), custom: true } : undefined;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ modelId: string }> }) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const { modelId } = await params;
  const found = await findUserModel(auth.user.id, modelId);
  if (!found) {
    return NextResponse.json({ status: "error", error: "Model not found", code: "MODEL_NOT_FOUND" }, { status: 404 });
  }
  let body: { enabled?: unknown };
  try {
    body = (await req.json()) as { enabled?: unknown };
  } catch {
    body = {};
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { status: "error", error: "enabled must be a boolean", code: "VALIDATION" },
      { status: 400 }
    );
  }
  await setModelEnabled(auth.user.id, found.config.id, body.enabled);
  return NextResponse.json(
    { status: "success", model: { ...found.config, custom: found.custom, enabled: body.enabled } },
    { status: 200 }
  );
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ modelId: string }> }) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const { modelId } = await params;
  if (modelRegistry.some((m) => m.id === modelId || m.slug === modelId)) {
    return NextResponse.json(
      { status: "error", error: "Built-in models cannot be removed", code: "BUILT_IN_MODEL" },
      { status: 400 }
    );
  }
  const deleted = await customModelRepository.deleteModel(auth.user.id, modelId);
  if (!deleted) {
    return NextResponse.json({ status: "error", error: "Model not found", code: "MODEL_NOT_FOUND" }, { status: 404 });
  }
  await deleteModelToggle(auth.user.id, modelId);
  return NextResponse.json({ status: "success" }, { status: 200 });
}