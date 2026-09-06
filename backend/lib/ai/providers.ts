import { getModelById, estimateCost } from "./models";

// ---------------------------------------------------------------------------
// Structured error â€” preserves HTTP status for callers, exposes a safe
// user-facing message that never leaks API keys or raw upstream text.
// ---------------------------------------------------------------------------

export class ProviderError extends Error {
  readonly status: number;
  readonly code: string;
  /** Safe, user-facing message â€” no secrets, no raw upstream text. */
  readonly safeMessage: string;
  /** Original upstream text (server-side only, never sent to client). */
  readonly upstreamDetail: string;
  /**
   * Structural marker so callers can detect a ProviderError even when a bundler
   * (or duplicate module graph) loads two copies of this class, which would make
   * `instanceof ProviderError` unreliable across module boundaries.
   */
  readonly isProviderError = true as const;

  constructor(opts: { status: number; message: string; code: string; safeMessage: string; upstreamDetail?: string }) {
    super(opts.message);
    this.name = "ProviderError";
    this.status = opts.status;
    this.code = opts.code;
    this.safeMessage = opts.safeMessage;
    this.upstreamDetail = opts.upstreamDetail ?? "";
  }
}

/** Robust ProviderError detection that survives duplicated module instances. */
export function isProviderError(err: unknown): err is ProviderError {
  return (
    (typeof err === "object" && err !== null && (err as { isProviderError?: boolean }).isProviderError === true) ||
    err instanceof ProviderError
  );
}

/** Map an HTTP status code to a safe, user-friendly message. */
function friendlyHttpError(status: number): { code: string; safeMessage: string } {
  switch (status) {
    case 400: return { code: "INVALID_REQUEST", safeMessage: "The model request was invalid. Check the prompt and parameters." };
    case 401: return { code: "AUTH_ERROR", safeMessage: "Authentication failed â€” check your OpenRouter API key." };
    case 403: return { code: "FORBIDDEN", safeMessage: "Access denied â€” your API key may lack permission for this model." };
    case 404: return { code: "MODEL_NOT_FOUND", safeMessage: "The model was not found on OpenRouter. It may have been removed or renamed." };
    case 402: return { code: "INSUFFICIENT_CREDITS", safeMessage: "Insufficient OpenRouter credits. Add funds at openrouter.ai/credits." };
    case 429: return { code: "RATE_LIMIT", safeMessage: "Rate limited by OpenRouter. Wait a moment and try again." };
    default: {
      if (status >= 500) return { code: "UPSTREAM_ERROR", safeMessage: `OpenRouter server error (${status}). Try again later.` };
      return { code: "HTTP_ERROR", safeMessage: `Request failed with status ${status}.` };
    }
  }
}

// ---------------------------------------------------------------------------
// Retry / backoff for transient HTTP 429 (rate limit) responses.
// Retries only retry-eligible (transient) failures and never fabricate a
// successful response â€” if all retries are exhausted the original error is
// propagated so the execution is marked failed, never faked as success.
// ---------------------------------------------------------------------------

const OPENROUTER_TIMEOUT_MS = 30000;
/** Max automatic retries for a transient 429 before giving up (total attempts = MAX_RETRIES + 1). */
const OPENROUTER_MAX_RETRIES = 2;
/** Base exponential backoff (ms) before the first retry. */
const OPENROUTER_BASE_RETRY_MS = 800;
/** Upper cap for a single backoff delay so one execution cannot stall the whole run. */
const OPENROUTER_MAX_BACKOFF_MS = 8000;
/** Cap on how long a provider-held rate-limit gate pauses other concurrent executions. */
const OPENROUTER_MAX_GATE_MS = 12000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/**
 * Compute how long to wait before a retry.
 * - If the upstream supplied a Retry-After header, honor it (capped + floored to
 *   avoid pathological values) with a small jitter.
 * - Otherwise use exponential backoff (base * 2^(n-1)) plus randomized jitter so
 *   concurrent executions do not retry in lock-step (avoids a thundering herd).
 */
function getRetryDelayMs(nextAttempt: number, retryAfterSeconds?: number | null): number {
  if (typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    const raw = retryAfterSeconds * 1000;
    const capped = Math.min(Math.max(raw, 250), OPENROUTER_MAX_BACKOFF_MS);
    return capped + Math.random() * 150;
  }
  const exp = OPENROUTER_BASE_RETRY_MS * Math.pow(2, Math.max(0, nextAttempt - 1));
  const jitter = Math.random() * exp * 0.3;
  return Math.min(exp + jitter, OPENROUTER_MAX_BACKOFF_MS);
}

// Shared rate-limit cooldown across all OpenRouterProvider instances in this
// process. When any execution observes a 429 it records when the provider is
// likely to accept traffic again; other concurrent executions pause at that
// gate before firing so a batch does not hammer the provider on every attempt.
let rateLimitGateUntil = 0;

function recordRateLimitGate(retryAfterSeconds?: number | null): void {
  const gate = Date.now() + Math.min(getRetryDelayMs(0, retryAfterSeconds), OPENROUTER_MAX_GATE_MS);
  if (gate > rateLimitGateUntil) rateLimitGateUntil = gate;
}

function getRateLimitGateDelayMs(): number {
  const remaining = rateLimitGateUntil - Date.now();
  return remaining > 0 ? remaining + Math.random() * 200 : 0;
}

/** Build the user-friendly message/error reported after 429 retries are exhausted. */
function buildRateLimitError(opts: {
  attempts: number;
  maxAttempts: number;
  retryAfterSeconds?: number | null;
  upstreamText?: string;
}): ProviderError {
  const retryHint =
    typeof opts.retryAfterSeconds === "number" && Number.isFinite(opts.retryAfterSeconds) && opts.retryAfterSeconds >= 0
      ? `Try again in about ${Math.ceil(opts.retryAfterSeconds)} seconds.`
      : "Wait a moment before retrying.";
  const exhausted =
    opts.attempts >= opts.maxAttempts
      ? ` Automatic retries were exhausted after ${opts.attempts} attempt${opts.attempts === 1 ? "" : "s"}.`
      : "";
  const safeMessage = `Rate limited by OpenRouter. ${retryHint}${exhausted}`;
  return new ProviderError({
    status: 429,
    message: `OpenRouter 429: ${(opts.upstreamText ?? "").slice(0, 200)}`,
    code: "RATE_LIMIT",
    safeMessage,
    upstreamDetail: (opts.upstreamText ?? "").slice(0, 300),
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderKind = "mock" | "openrouter";

export interface GenerationRequest {
  modelId: string; // OpenRouter id or slug, e.g. "openai/gpt-4o"
  systemPrompt?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  seed?: number;
  /** Optional trace id for logging */
  traceId?: string;
  /** Test case id for pipeline correlation */
  testCaseId?: string;
}

export interface GenerationUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerationResponse {
  id: string;
  modelId: string;
  content: string;
  usage: GenerationUsage;
  cost: number; // USD
  latencyMs: number;
  finishReason?: "stop" | "length" | "content_filter" | "tool_calls";
  createdAt: string;
}

export interface AIProvider {
  kind: ProviderKind;
  isAvailable(): boolean;
  generate(request: GenerationRequest): Promise<GenerationResponse>;
  generateBatch(requests: GenerationRequest[]): Promise<GenerationResponse[]>;
}

// ---------------------------------------------------------------------------
// Env helpers â€” no hardcoded keys
// ---------------------------------------------------------------------------

function getEnv(name: string): string | undefined {
  // Works in both Node (process.env) and Edge (process?.env)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (globalThis as any)?.process?.env ?? (typeof process !== "undefined" ? (process as any).env : undefined);
    return env?.[name];
  } catch {
    return undefined;
  }
}

export function getOpenRouterConfig(): { apiKey?: string; baseUrl: string; appUrl?: string; appName?: string } {
  return {
    apiKey: getEnv("OPENROUTER_API_KEY"),
    baseUrl: getEnv("OPENROUTER_BASE_URL") || "https://openrouter.ai/api/v1",
    appUrl: getEnv("OPENROUTER_APP_URL") || "https://rittikevalops.ai",
    appName: getEnv("OPENROUTER_APP_NAME") || "RittikEvalOpsAI",
  };
}

// ---------------------------------------------------------------------------
// Mock Provider â€” deterministic, no network, for frontend dev
// ---------------------------------------------------------------------------

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function mockLatencyForModel(modelId: string): number {
  const m = getModelById(modelId);
  // Use model's real latency as hint, add jitter
  const base = (m ? m.contextLength > 100000 ? 1.4 : 0.9 : 1) * 1000;
  return Math.round(base + (hashString(modelId) % 600));
}

const MOCK_ANSWERS: Record<string, string> = {
  default: "This is a mock response generated for evaluation. The answer is concise, faithful to context, and demonstrates the model's reasoning.",
  code: "```python\ndef solve(n):\n    # Mock solution â€” replace with OpenRouter call\n    return n * 2\n```",
  vision: "I can see the image contains [mock vision analysis]. Based on the visual context, the answer is ...",
};

export class MockProvider implements AIProvider {
  kind: ProviderKind = "mock";

  isAvailable(): boolean {
    return true;
  }

  async generate(req: GenerationRequest): Promise<GenerationResponse> {
    const start = Date.now();
    const latency = mockLatencyForModel(req.modelId);
    // Simulate network
    await new Promise((r) => setTimeout(r, Math.min(latency, 1200)));

    const h = hashString(req.prompt + req.modelId);
    const isCode = req.prompt.toLowerCase().includes("code") || req.prompt.includes("```");
    const content = isCode ? MOCK_ANSWERS.code : MOCK_ANSWERS.default + ` [mock:${req.modelId}:${h % 1000}]`;

    const promptTokens = Math.ceil(req.prompt.length / 4) + (req.systemPrompt ? Math.ceil(req.systemPrompt.length / 4) : 0);
    const completionTokens = Math.ceil(content.length / 4);
    const cost = estimateCost(req.modelId, promptTokens, completionTokens);
    const model = getModelById(req.modelId);

    return {
      id: `mock_${Date.now()}_${h % 10000}`,
      modelId: req.modelId,
      content,
      usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
      cost,
      latencyMs: Date.now() - start,
      finishReason: "stop",
      createdAt: new Date().toISOString(),
    };
  }

  async generateBatch(requests: GenerationRequest[]): Promise<GenerationResponse[]> {
    // Sequential mock to mimic rate limits; keep deterministic
    const results: GenerationResponse[] = [];
    for (const r of requests) {
      results.push(await this.generate(r));
    }
    return results;
  }
}

// ---------------------------------------------------------------------------
// OpenRouter Provider â€” skeleton, no hardcoded key
// ---------------------------------------------------------------------------

export class OpenRouterProvider implements AIProvider {
  kind: ProviderKind = "openrouter";
  private baseUrl: string;
  private apiKey?: string;
  private appUrl: string;
  private appName: string;

  constructor(opts?: { apiKey?: string; baseUrl?: string; appUrl?: string; appName?: string }) {
    const cfg = getOpenRouterConfig();
    this.apiKey = opts?.apiKey ?? cfg.apiKey;
    this.baseUrl = opts?.baseUrl ?? cfg.baseUrl;
    this.appUrl = opts?.appUrl ?? cfg.appUrl ?? "https://rittikevalops.ai";
    this.appName = opts?.appName ?? cfg.appName ?? "RittikEvalOpsAI";
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generate(req: GenerationRequest): Promise<GenerationResponse> {
    if (!this.isAvailable()) {
      throw new Error("OPENROUTER_API_KEY is not set. Set it in .env.local to enable OpenRouter.");
    }

    const model = getModelById(req.modelId);
    const modelId = model?.openRouterId ?? req.modelId;

    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (req.systemPrompt) messages.push({ role: "system", content: req.systemPrompt });
    messages.push({ role: "user", content: req.prompt });

    const maxAttempts = OPENROUTER_MAX_RETRIES + 1; // 1 initial + retries
    const start = Date.now();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Shared rate-limit gate: if another concurrent execution recently hit a
      // 429, hold before firing so a batch does not hammer the provider. The
      // gate delay is small and capped so it never stalls the whole run.
      const gateDelay = getRateLimitGateDelayMs();
      if (gateDelay > 0) await sleep(gateDelay);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

      try {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": this.appUrl,
            "X-Title": this.appName,
          },
          body: JSON.stringify({
            model: modelId,
            messages,
            temperature: req.temperature ?? 0.7,
            max_tokens: req.maxTokens,
            top_p: req.topP,
            seed: req.seed,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        // Transient rate limit: honor Retry-After (or exponential backoff),
        // retry up to maxAttempts. Never fabricate a successful response.
        if (res.status === 429) {
          const text = await res.text().catch(() => "");
          const header = res.headers.get("retry-after");
          const retryAfterSeconds = header ? Number(parseFloat(header)) : null;
          const retryAfter = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null;
          // Pause other concurrent executions at the shared gate too.
          recordRateLimitGate(retryAfter);

          if (attempt < maxAttempts) {
            const delay = getRetryDelayMs(attempt, retryAfter);
            await sleep(delay);
            continue;
          }

          throw buildRateLimitError({ attempts: attempt, maxAttempts, retryAfterSeconds: retryAfter, upstreamText: text });
        }

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          const { code, safeMessage } = friendlyHttpError(res.status);
          throw new ProviderError({
            status: res.status,
            message: `OpenRouter ${res.status}: ${text.slice(0, 200)}`,
            code,
            safeMessage,
            upstreamDetail: text.slice(0, 300),
          });
        }

        const json = (await res.json()) as {
          id: string;
          choices: Array<{ message: { content: string }; finish_reason?: string }>;
          usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        };

        const content = json.choices?.[0]?.message?.content ?? "";
        const usage = json.usage ?? {
          prompt_tokens: Math.ceil(req.prompt.length / 4),
          completion_tokens: Math.ceil(content.length / 4),
          total_tokens: Math.ceil(req.prompt.length / 4) + Math.ceil(content.length / 4),
        };

        const promptTokens = usage.prompt_tokens;
        const completionTokens = usage.completion_tokens;
        const cost = estimateCost(req.modelId, promptTokens, completionTokens);

        return {
          id: json.id || `or_${Date.now()}`,
          modelId: req.modelId,
          content,
          usage: { promptTokens, completionTokens, totalTokens: usage.total_tokens },
          cost,
          latencyMs: Date.now() - start,
          finishReason: (json.choices?.[0]?.finish_reason as GenerationResponse["finishReason"]) || "stop",
          createdAt: new Date().toISOString(),
        };
      } catch (err: unknown) {
        clearTimeout(timeout);
        if (err instanceof Error && err.name === "AbortError") {
          // Timeout is transient too â€” retry if attempts remain.
          if (attempt < maxAttempts) {
            const delay = getRetryDelayMs(attempt, null);
            await sleep(delay);
            continue;
          }
          throw new ProviderError({
            status: 408,
            message: "OpenRouter request timed out after 30s",
            code: "TIMEOUT",
            safeMessage: "Request timed out after 30 seconds. The model may be overloaded â€” try again.",
          });
        }
        throw err;
      }
    }

    // Unreachable: either returned or threw above.
    throw new ProviderError({
      status: 429,
      message: "OpenRouter request failed after retries",
      code: "RATE_LIMIT",
      safeMessage: "Rate limited by OpenRouter. Wait a moment and try again.",
    });
  }

  async generateBatch(requests: GenerationRequest[]): Promise<GenerationResponse[]> {
    // Simple parallel with concurrency limit 4 to respect rate limits
    const concurrency = 4;
    const results: GenerationResponse[] = [];
    for (let i = 0; i < requests.length; i += concurrency) {
      const chunk = requests.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map((r) => this.generate(r)));
      results.push(...chunkResults);
    }
    return results;
  }
}

// ---------------------------------------------------------------------------
// Factory â€” UI should use this, not instantiate providers directly
// ---------------------------------------------------------------------------

export type ProviderOptions = {
  kind?: ProviderKind;
  apiKey?: string;
  baseUrl?: string;
};

function getEffectiveProviderKind(opts?: ProviderOptions): ProviderKind {
  if (opts?.kind) return opts.kind;
  const envKind = getEnv("AI_PROVIDER") as ProviderKind | undefined;
  if (envKind) return envKind;
  // Auto-detect: use OpenRouter if key exists, otherwise mock
  const cfg = getOpenRouterConfig();
  if (cfg.apiKey && cfg.apiKey.trim() !== "") return "openrouter";
  return "mock";
}

export function createProvider(opts?: ProviderOptions): AIProvider {
  const kind = getEffectiveProviderKind(opts);
  if (kind === "openrouter") {
    const p = new OpenRouterProvider({ apiKey: opts?.apiKey, baseUrl: opts?.baseUrl });
    // Graceful fallback to mock if key missing (dev)
    if (!p.isAvailable()) {
      console.warn("[RittikEvalOpsAI] OPENROUTER_API_KEY missing â€” falling back to mock provider.");
      return new MockProvider();
    }
    return p;
  }
  return new MockProvider();
}

// Singleton for UI convenience
let defaultProvider: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (!defaultProvider) defaultProvider = createProvider();
  return defaultProvider;
}

export function setProvider(provider: AIProvider): void {
  defaultProvider = provider;
}
