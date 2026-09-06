import { NextRequest, NextResponse } from "next/server";
import { datasetRepository } from "@/lib/datasets/repository";
import { requireCurrentUser } from "@/lib/auth/api";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const { id } = await params;
  const ds = await datasetRepository.getDataset(id, auth.user.id);
  if (!ds) return NextResponse.json({ status: "error", error: "DATASET_NOT_FOUND", code: "DATASET_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ status: "success", dataset: ds }, { status: 200 });
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
  const name = b.name as string | undefined;
  const description = b.description as string | undefined;

  if (name !== undefined && (!name.trim())) {
    return NextResponse.json({ status: "error", error: "Dataset name cannot be empty" }, { status: 400 });
  }

  const updated = await datasetRepository.updateDataset(id, auth.user.id, {
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
  });
  if (!updated) return NextResponse.json({ status: "error", error: "DATASET_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ status: "success", dataset: updated }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const { id } = await params;
  const ok = await datasetRepository.deleteDataset(id, auth.user.id);
  if (!ok) return NextResponse.json({ status: "error", error: "DATASET_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ status: "success" }, { status: 200 });
}