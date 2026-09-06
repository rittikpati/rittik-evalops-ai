import { NextRequest, NextResponse } from "next/server";
import { datasetRepository } from "@/lib/datasets/repository";
import { requireCurrentUser } from "@/lib/auth/api";

export async function GET(req: NextRequest) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const datasets = await datasetRepository.getDatasets(auth.user.id);
  return NextResponse.json({ status: "success", datasets }, { status: 200 });
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
  const description = b.description as string | undefined;
  const format = b.format as string | undefined;
  const version = b.version as string | undefined;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ status: "error", error: "Dataset name is required", code: "VALIDATION" }, { status: 400 });
  }
  if (name.trim().length > 80) {
    return NextResponse.json({ status: "error", error: "Dataset name too long (max 80)" }, { status: 400 });
  }
  if (version !== undefined && (typeof version !== "string" || version.trim().length === 0 || version.trim().length > 20)) {
    return NextResponse.json({ status: "error", error: "Invalid version (max 20 characters)" }, { status: 400 });
  }

  const ds = await datasetRepository.createDataset({
    name: name.trim(),
    ownerId: auth.user.id,
    description: description?.trim(),
    format: format as never,
    version: version?.trim() || "v1.0",
  });
  return NextResponse.json({ status: "success", dataset: ds }, { status: 201 });
}