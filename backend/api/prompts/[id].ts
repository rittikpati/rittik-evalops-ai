import { NextRequest, NextResponse } from "next/server";
import { promptsRepository } from "@/lib/prompts/repository";
import { requireCurrentUser } from "@/lib/auth/api";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const { id } = await params;
  const prompt = await promptsRepository.getPrompt(id, auth.user.id);
  if (!prompt) return NextResponse.json({ status: "error", error: "PROMPT_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ status: "success", prompt }, { status: 200 });
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

  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) {
    const name = String(b.name);
    if (!name.trim()) return NextResponse.json({ status: "error", error: "NAME_REQUIRED", code: "NAME_REQUIRED" }, { status: 400 });
    if (name.trim().length > 200) return NextResponse.json({ status: "error", error: "NAME_TOO_LONG", code: "NAME_TOO_LONG" }, { status: 400 });
    patch.name = name.trim();
  }
  if (b.systemPrompt !== undefined) {
    const systemPrompt = String(b.systemPrompt);
    if (systemPrompt.length > 20000) return NextResponse.json({ status: "error", error: "SYSTEM_PROMPT_TOO_LONG", code: "SYSTEM_PROMPT_TOO_LONG" }, { status: 400 });
    patch.systemPrompt = systemPrompt;
  }
  if (b.userPrompt !== undefined) {
    const userPrompt = String(b.userPrompt);
    if (!userPrompt.trim()) return NextResponse.json({ status: "error", error: "USER_PROMPT_REQUIRED", code: "USER_PROMPT_REQUIRED" }, { status: 400 });
    if (userPrompt.length > 20000) return NextResponse.json({ status: "error", error: "USER_PROMPT_TOO_LONG", code: "USER_PROMPT_TOO_LONG" }, { status: 400 });
    patch.userPrompt = userPrompt;
  }

  const updated = await promptsRepository.updatePrompt(id, auth.user.id, patch);
  if (!updated) return NextResponse.json({ status: "error", error: "PROMPT_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ status: "success", prompt: updated }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const { id } = await params;
  const ok = await promptsRepository.deletePrompt(id, auth.user.id);
  if (!ok) return NextResponse.json({ status: "error", error: "PROMPT_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ status: "success" }, { status: 200 });
}