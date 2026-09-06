import { NextRequest, NextResponse } from "next/server";
import { promptsRepository } from "@/lib/prompts/repository";
import { requireCurrentUser } from "@/lib/auth/api";

export async function GET(req: NextRequest) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  const prompts = await promptsRepository.getPrompts(auth.user.id);
  return NextResponse.json({ status: "success", prompts }, { status: 200 });
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
  const systemPrompt = b.systemPrompt as string | undefined;
  const userPrompt = b.userPrompt as string;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ status: "error", error: "Prompt name required" }, { status: 400 });
  }
  if (name.trim().length > 200) {
    return NextResponse.json({ status: "error", error: "NAME_TOO_LONG" }, { status: 400 });
  }
  if (systemPrompt !== undefined && (typeof systemPrompt !== "string" || systemPrompt.length > 20000)) {
    return NextResponse.json({ status: "error", error: "SYSTEM_PROMPT_TOO_LONG" }, { status: 400 });
  }
  if (!userPrompt || typeof userPrompt !== "string" || !userPrompt.trim()) {
    return NextResponse.json({ status: "error", error: "userPrompt required" }, { status: 400 });
  }
  if (userPrompt.length > 20000) {
    return NextResponse.json({ status: "error", error: "USER_PROMPT_TOO_LONG" }, { status: 400 });
  }

  const prompt = await promptsRepository.createPrompt({
    ownerId: auth.user.id,
    name: name.trim(),
    systemPrompt: systemPrompt?.trim() || undefined,
    userPrompt,
  });

  return NextResponse.json({ status: "success", prompt }, { status: 201 });
}