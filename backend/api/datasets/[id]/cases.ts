import { NextRequest, NextResponse } from "next/server";
import { datasetRepository } from "@/lib/datasets/repository";
import { requireCurrentUser } from "@/lib/auth/api";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const { id } = await params;
  const ds = await datasetRepository.getDataset(id, auth.user.id);
  if (!ds) return NextResponse.json({ status: "error", error: "DATASET_NOT_FOUND" }, { status: 404 });
  const cases = await datasetRepository.getTestCases(id, auth.user.id);
  return NextResponse.json({ status: "success", testCases: cases }, { status: 200 });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const { id } = await params;
  const ds = await datasetRepository.getDataset(id, auth.user.id);
  if (!ds) return NextResponse.json({ status: "error", error: "DATASET_NOT_FOUND" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Malformed JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const input = b.input as string;
  const expectedOutput = b.expectedOutput as string | undefined;
  const context = b.context as string | undefined;

  if (!input || typeof input !== "string" || !input.trim()) {
    return NextResponse.json({ status: "error", error: "Test case input is required", code: "VALIDATION" }, { status: 400 });
  }
  if (input.trim().length > 2000) {
    return NextResponse.json({ status: "error", error: "Input too long (max 2000)" }, { status: 400 });
  }

  const tc = await datasetRepository.createTestCase(id, auth.user.id, {
    input: input.trim(),
    expectedOutput: expectedOutput?.trim() || "",
    context: context?.trim() || undefined,
  });
  if (!tc) return NextResponse.json({ status: "error", error: "Failed to create test case" }, { status: 500 });
  return NextResponse.json({ status: "success", testCase: tc }, { status: 201 });
}