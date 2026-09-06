import { NextRequest, NextResponse } from "next/server";
import { datasetRepository } from "@/lib/datasets/repository";
import { requireCurrentUser } from "@/lib/auth/api";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; caseId: string }> }) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const { id, caseId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Malformed JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const input = b.input as string | undefined;
  const expectedOutput = b.expectedOutput as string | undefined;
  const context = b.context as string | undefined;

  if (input !== undefined && (!input.trim())) {
    return NextResponse.json({ status: "error", error: "Input cannot be empty" }, { status: 400 });
  }

  const updated = await datasetRepository.updateTestCase(id, auth.user.id, caseId, {
    ...(input !== undefined ? { input } : {}),
    ...(expectedOutput !== undefined ? { expectedOutput } : {}),
    ...(context !== undefined ? { context } : {}),
  });
  if (!updated) return NextResponse.json({ status: "error", error: "DATASET_OR_CASE_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ status: "success", testCase: updated }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; caseId: string }> }) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const { id, caseId } = await params;
  const ok = await datasetRepository.deleteTestCase(id, auth.user.id, caseId);
  if (!ok) return NextResponse.json({ status: "error", error: "DATASET_OR_CASE_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ status: "success" }, { status: 200 });
}