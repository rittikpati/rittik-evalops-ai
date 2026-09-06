import { NextRequest, NextResponse } from "next/server";
import { getModelById, estimateCost } from "@/lib/ai/models";
import { OpenRouterProvider } from "@/lib/ai/providers";
import { requireCurrentUser } from "@/lib/auth/api";

// ---------------------------------------------------------------------------
// Types — strict, shared with client
// ---------------------------------------------------------------------------

export interface OpenRouterChatRequest {
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface OpenRouterChatSuccess {
  model: string;
  output: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latency: number;
  estimatedCost: number | null;
  status: "success";
}

export interface OpenRouterChatError {
  status: "error";
  error: string;
  code?: string;
}

export type OpenRouterChatResponse = OpenRouterChatSuccess | OpenRouterChatError;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function validateBody(body: unknown): { ok: true; data: OpenRouterChatRequest } | { ok: false; error: string; status: number } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid JSON body", status: 400 };
  }
  const b = body as Record<string, unknown>;

  const model = b.model;
  const userPrompt = b.userPrompt;
  const systemPrompt = b.systemPrompt;
  const temperature = b.temperature;
  const maxTokens = b.maxTokens;

  if (!isNonEmptyString(model)) {
    return { ok: false, error: "model must be a non-empty string", status: 400 };
  }
  if (!isNonEmptyString(userPrompt)) {
    return { ok: false, error: "userPrompt must be a non-empty string", status: 400 };
  }
  if (systemPrompt !== undefined && systemPrompt !== null && typeof systemPrompt !== "string") {
    return { ok: false, error: "systemPrompt must be a string", status: 400 };
  }
  if (temperature !== undefined) {
    if (typeof temperature !== "number" || Number.isNaN(temperature) || temperature < 0 || temperature > 2) {
      return { ok: false, error: "temperature must be a number between 0 and 2", status: 400 };
    }
  }
  if (maxTokens !== undefined) {
    if (typeof maxTokens !== "number" || !Number.isInteger(maxTokens) || maxTokens <= 0 || maxTokens > 128000) {
      return { ok: false, error: "maxTokens must be a positive integer (1-128000)", status: 400 };
    }
  }

  return {
    ok: true,
    data: {
      model: model.trim(),
      systemPrompt: typeof systemPrompt === "string" ? systemPrompt : undefined,
      userPrompt: userPrompt.trim(),
      temperature: typeof temperature === "number" ? temperature : 0.7,
      maxTokens: typeof maxTokens === "number" ? maxTokens : 1000,
    },
  };
}

// ---------------------------------------------------------------------------
// POST /api/openrouter/chat — server-side only, key never leaves server
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 0. Authentication — every client call is user-scoped
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;

  // 1. Env — server-side only, never from frontend, never logged
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    return NextResponse.json(
      { status: "error", error: "Server not configured: OPENROUTER_API_KEY is missing. Add it to .env.local.", code: "MISSING_API_KEY" } satisfies OpenRouterChatError,
      { status: 500 }
    );
  }

  // 2. Parse & validate body — reject malformed JSON
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Malformed JSON body", code: "INVALID_JSON" } satisfies OpenRouterChatError, { status: 400 });
  }

  const validated = validateBody(raw);
  if (!validated.ok) {
    return NextResponse.json({ status: "error", error: validated.error, code: "INVALID_REQUEST" } satisfies OpenRouterChatError, { status: validated.status });
  }

  const { model, systemPrompt, userPrompt, temperature, maxTokens } = validated.data;

  // Reuse existing provider abstraction — server-side only, no key exposure
  const registryEntry = getModelById(model);

  try {
    const provider = new OpenRouterProvider();
    // provider will throw if key missing — map to 500
    if (!provider.isAvailable()) {
      return NextResponse.json(
        { status: "error", error: "Server not configured: OPENROUTER_API_KEY is missing. Add it to .env.local.", code: "MISSING_API_KEY" } satisfies OpenRouterChatError,
        { status: 500 }
      );
    }

    const result = await provider.generate({
      modelId: model,
      systemPrompt,
      prompt: userPrompt,
      temperature,
      maxTokens,
    });

    // Estimated cost — use registry pricing if available, else null (never fake)
    let estimatedCost: number | null = null;
    try {
      const cost = estimateCost(model, result.usage.promptTokens, result.usage.completionTokens);
      estimatedCost = Number.isFinite(cost) && cost !== 0 ? cost : result.cost || null;
      if (!registryEntry && estimatedCost === 0) estimatedCost = null;
    } catch {
      estimatedCost = null;
    }

    const body: OpenRouterChatSuccess = {
      model,
      output: result.content,
      usage: {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
      latency: result.latencyMs,
      estimatedCost,
      status: "success",
    };

    return NextResponse.json(body, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    const safe = message.replace(apiKey, "[REDACTED]");

    if (safe.includes("timed out")) {
      return NextResponse.json({ status: "error", error: "OpenRouter request timed out after 30s.", code: "TIMEOUT" } satisfies OpenRouterChatError, { status: 504 });
    }
    if (safe.includes("401") || safe.toLowerCase().includes("auth")) {
      return NextResponse.json({ status: "error", error: "OpenRouter authentication failed. Check server API key.", code: "AUTH_ERROR" } satisfies OpenRouterChatError, { status: 401 });
    }
    if (safe.includes("429") || safe.toLowerCase().includes("rate limit")) {
      return NextResponse.json({ status: "error", error: "OpenRouter rate limit exceeded. Try again shortly.", code: "RATE_LIMIT" } satisfies OpenRouterChatError, { status: 429 });
    }
    if (safe.includes("500") || safe.toLowerCase().includes("server error")) {
      return NextResponse.json({ status: "error", error: "OpenRouter server error. Try again later.", code: "UPSTREAM_ERROR" } satisfies OpenRouterChatError, { status: 502 });
    }

    console.error("[openrouter/chat] unexpected", safe.slice(0, 300));
    return NextResponse.json({ status: "error", error: safe.slice(0, 500) || "Unexpected server error. Try again.", code: "INTERNAL" } satisfies OpenRouterChatError, { status: 500 });
  }
}

// Only POST allowed
export async function GET() {
  return NextResponse.json({ status: "error", error: "Method not allowed. Use POST.", code: "METHOD_NOT_ALLOWED" } satisfies OpenRouterChatError, { status: 405 });
}
