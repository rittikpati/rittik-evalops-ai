export type ModelProvider =
  | "openai"
  | "anthropic"
  | "meta"
  | "alibaba"
  | "google"
  | "mistral"
  | "deepseek"
  | "xai"
  | "cohere"
  | "perplexity"
  | "openrouter";

export type ModelCapability =
  | "text"
  | "vision"
  | "audio"
  | "video"
  | "function-calling"
  | "tool-use"
  | "json-mode"
  | "reasoning"
  | "code"
  | "long-context"
  | "multilingual"
  | "streaming";

export type ModelStatus = "active" | "beta" | "deprecated" | "preview";

export interface ModelPricing {
  /** USD per 1M prompt tokens */
  prompt: number;
  /** USD per 1M completion tokens */
  completion: number;
  /** Optional image pricing per 1K images */
  image?: number;
  /** Currency, defaults to USD */
  currency?: "USD";
  /** Cached pricing reference */
  per1kPrompt?: number;
  per1kCompletion?: number;
}

export interface ModelConfig {
  /** OpenRouter compatible id, e.g. "openai/gpt-4o" or "anthropic/claude-3.5-sonnet" */
  id: string;
  /** Short id for UI, e.g. "gpt-4o" */
  slug: string;
  provider: ModelProvider;
  name: string;
  displayName: string;
  version: string;
  contextLength: number;
  maxOutputTokens: number;
  pricing: ModelPricing;
  capabilities: ModelCapability[];
  status: ModelStatus;
  description?: string;
  releasedAt?: string;
  /** OpenRouter model endpoint */
  openRouterId: string;
}

// Central registry â€” single source of truth for UI + provider layer
export const modelRegistry: ModelConfig[] = [
  // OpenAI â€” GPT
  {
    id: "openai/gpt-4o",
    slug: "gpt-4o",
    provider: "openai",
    name: "GPT-4o",
    displayName: "GPT-4o",
    version: "2024-11-20",
    contextLength: 128000,
    maxOutputTokens: 16384,
    pricing: { prompt: 2.5, completion: 10, currency: "USD", per1kPrompt: 0.0025, per1kCompletion: 0.01 },
    capabilities: ["text", "vision", "audio", "function-calling", "json-mode", "streaming"],
    status: "active",
    description: "OpenAI flagship multimodal â€” best for general reasoning, vision, and speed.",
    openRouterId: "openai/gpt-4o",
    releasedAt: "2024-05-13",
  },
  {
    id: "openai/gpt-4o-mini",
    slug: "gpt-4o-mini",
    provider: "openai",
    name: "GPT-4o Mini",
    displayName: "GPT-4o Mini",
    version: "2024-07-18",
    contextLength: 128000,
    maxOutputTokens: 16384,
    pricing: { prompt: 0.15, completion: 0.6, currency: "USD", per1kPrompt: 0.00015, per1kCompletion: 0.0006 },
    capabilities: ["text", "vision", "function-calling", "json-mode", "streaming"],
    status: "active",
    description: "Cost-efficient GPT-4o variant â€” ideal for large-scale evaluation.",
    openRouterId: "openai/gpt-4o-mini",
  },
  {
    id: "openai/gpt-4-turbo",
    slug: "gpt-4-turbo",
    provider: "openai",
    name: "GPT-4 Turbo",
    displayName: "GPT-4 Turbo",
    version: "2024-04-09",
    contextLength: 128000,
    maxOutputTokens: 4096,
    pricing: { prompt: 10, completion: 30, currency: "USD" },
    capabilities: ["text", "vision", "function-calling", "json-mode"],
    status: "active",
    openRouterId: "openai/gpt-4-turbo",
  },
  // Anthropic â€” Claude
  {
    id: "anthropic/claude-3.5-sonnet",
    slug: "claude-3-5-sonnet",
    provider: "anthropic",
    name: "Claude 3.5 Sonnet",
    displayName: "Claude 3.5 Sonnet",
    version: "2024-10-22",
    contextLength: 200000,
    maxOutputTokens: 8192,
    pricing: { prompt: 3, completion: 15, currency: "USD", per1kPrompt: 0.003, per1kCompletion: 0.015 },
    capabilities: ["text", "vision", "function-calling", "tool-use", "reasoning", "code"],
    status: "active",
    description: "Anthropic's best for coding, reasoning, and long-context.",
    // NOTE: OpenRouter retired `anthropic/claude-3.5-sonnet` (404 "No endpoints
    // found"). Route the selectable "Claude 3.5 Sonnet" entry to a current,
    // valid Sonnet endpoint (`claude-sonnet-4.5`, same $3/$15 pricing) so it can
    // execute when the provider/account allows. The `id`/`slug` are preserved so
    // existing experiments referencing Claude 3.5 Sonnet keep resolving.
    openRouterId: "anthropic/claude-sonnet-4.5",
  },
  {
    id: "anthropic/claude-3-haiku",
    slug: "claude-3-haiku",
    provider: "anthropic",
    name: "Claude 3 Haiku",
    displayName: "Claude 3 Haiku",
    version: "2024-03-07",
    contextLength: 200000,
    maxOutputTokens: 4096,
    pricing: { prompt: 0.25, completion: 1.25, currency: "USD" },
    capabilities: ["text", "vision", "tool-use"],
    status: "active",
    openRouterId: "anthropic/claude-3-haiku",
  },
  {
    id: "anthropic/claude-3-opus",
    slug: "claude-3-opus",
    provider: "anthropic",
    name: "Claude 3 Opus",
    displayName: "Claude 3 Opus",
    version: "2024-02-29",
    contextLength: 200000,
    maxOutputTokens: 4096,
    pricing: { prompt: 15, completion: 75, currency: "USD" },
    capabilities: ["text", "vision", "tool-use", "reasoning"],
    status: "active",
    openRouterId: "anthropic/claude-3-opus",
  },
  // Meta â€” Llama
  {
    id: "meta-llama/llama-3.1-405b-instruct",
    slug: "llama-3.1-405b",
    provider: "meta",
    name: "Llama 3.1 405B",
    displayName: "Llama 3.1 405B",
    version: "2024-07-23",
    contextLength: 128000,
    maxOutputTokens: 4096,
    pricing: { prompt: 0.8, completion: 0.8, currency: "USD", per1kPrompt: 0.0008, per1kCompletion: 0.0008 },
    capabilities: ["text", "function-calling", "tool-use", "code", "long-context"],
    status: "active",
    description: "Meta's largest open model â€” competitive with GPT-4/Claude on many tasks.",
    openRouterId: "meta-llama/llama-3.1-405b-instruct",
  },
  {
    id: "meta-llama/llama-3.1-70b-instruct",
    slug: "llama-3.1-70b",
    provider: "meta",
    name: "Llama 3.1 70B",
    displayName: "Llama 3.1 70B",
    version: "2024-07-23",
    contextLength: 128000,
    maxOutputTokens: 4096,
    pricing: { prompt: 0.52, completion: 0.75, currency: "USD" },
    capabilities: ["text", "function-calling", "code"],
    status: "active",
    openRouterId: "meta-llama/llama-3.1-70b-instruct",
  },
  {
    id: "meta-llama/llama-3.1-8b-instruct",
    slug: "llama-3.1-8b",
    provider: "meta",
    name: "Llama 3.1 8B",
    displayName: "Llama 3.1 8B",
    version: "2024-07-23",
    contextLength: 128000,
    maxOutputTokens: 4096,
    pricing: { prompt: 0.05, completion: 0.05, currency: "USD" },
    capabilities: ["text", "function-calling"],
    status: "active",
    openRouterId: "meta-llama/llama-3.1-8b-instruct",
  },
  // Alibaba â€” Qwen
  {
    id: "qwen/qwen-2.5-72b-instruct",
    slug: "qwen-2.5-72b",
    provider: "alibaba",
    name: "Qwen 2.5 72B",
    displayName: "Qwen 2.5 72B",
    version: "2024-09-19",
    contextLength: 128000,
    maxOutputTokens: 8192,
    pricing: { prompt: 0.35, completion: 0.4, currency: "USD", per1kPrompt: 0.00035, per1kCompletion: 0.0004 },
    capabilities: ["text", "vision", "function-calling", "tool-use", "multilingual", "code"],
    status: "active",
    description: "Alibaba flagship â€” strong multilingual and math.",
    openRouterId: "qwen/qwen-2.5-72b-instruct",
  },
  {
    id: "qwen/qwen-2.5-7b-instruct",
    slug: "qwen-2.5-7b",
    provider: "alibaba",
    name: "Qwen 2.5 7B",
    displayName: "Qwen 2.5 7B",
    version: "2024-09-19",
    contextLength: 32768,
    maxOutputTokens: 8192,
    pricing: { prompt: 0.05, completion: 0.05, currency: "USD" },
    capabilities: ["text", "multilingual"],
    status: "active",
    openRouterId: "qwen/qwen-2.5-7b-instruct",
  },
  // Google
  {
    id: "google/gemini-1.5-pro",
    slug: "gemini-1.5-pro",
    provider: "google",
    name: "Gemini 1.5 Pro",
    displayName: "Gemini 1.5 Pro",
    version: "2024-05-14",
    contextLength: 1000000,
    maxOutputTokens: 8192,
    pricing: { prompt: 1.25, completion: 5, currency: "USD" },
    capabilities: ["text", "vision", "audio", "video", "function-calling", "long-context"],
    status: "active",
    openRouterId: "google/gemini-pro-1.5",
  },
  {
    id: "google/gemini-1.5-flash",
    slug: "gemini-1.5-flash",
    provider: "google",
    name: "Gemini 1.5 Flash",
    displayName: "Gemini 1.5 Flash",
    version: "2024-05-14",
    contextLength: 1000000,
    maxOutputTokens: 8192,
    pricing: { prompt: 0.075, completion: 0.3, currency: "USD" },
    capabilities: ["text", "vision", "audio", "long-context", "streaming"],
    status: "active",
    openRouterId: "google/gemini-flash-1.5",
  },
  // Mistral
  {
    id: "mistralai/mistral-large",
    slug: "mistral-large",
    provider: "mistral",
    name: "Mistral Large",
    displayName: "Mistral Large",
    version: "2024-07-24",
    contextLength: 128000,
    maxOutputTokens: 4096,
    pricing: { prompt: 2, completion: 6, currency: "USD" },
    capabilities: ["text", "function-calling", "tool-use", "multilingual"],
    status: "active",
    openRouterId: "mistralai/mistral-large",
  },
  // DeepSeek
  {
    id: "deepseek/deepseek-v3",
    slug: "deepseek-v3",
    provider: "deepseek",
    name: "DeepSeek V3",
    displayName: "DeepSeek V3",
    version: "2024-12-26",
    contextLength: 128000,
    maxOutputTokens: 8192,
    pricing: { prompt: 0.14, completion: 0.28, currency: "USD" },
    capabilities: ["text", "code", "reasoning", "function-calling"],
    status: "active",
    openRouterId: "deepseek/deepseek-chat",
  },
  // xAI
  {
    id: "x-ai/grok-2",
    slug: "grok-2",
    provider: "xai",
    name: "Grok 2",
    displayName: "Grok 2",
    version: "2024-08-20",
    contextLength: 131072,
    maxOutputTokens: 4096,
    pricing: { prompt: 5, completion: 15, currency: "USD" },
    capabilities: ["text", "vision", "function-calling", "reasoning"],
    status: "beta",
    openRouterId: "x-ai/grok-2",
  },
  // Free-tier model for cost-free evaluation testing
  {
    id: "dots-studio/dots-3-note-preview",
    slug: "dots-3-note-preview",
    provider: "openai",
    name: "Dots 3 Note Preview",
    displayName: "Dots 3 Note Preview (Free)",
    version: "2025-08-28",
    contextLength: 131072,
    maxOutputTokens: 8192,
    pricing: { prompt: 0, completion: 0, currency: "USD" },
    capabilities: ["text", "reasoning", "code"],
    status: "active",
    description: "Free-tier reasoning model â€” perfect for cost-free evaluation testing.",
    openRouterId: "dots-studio/dots-3-note-preview:free",
  },
  // Free Router â€” auto-routes to whatever free model is available upstream.
  // Registered as the default JUDGE so a $0 account still gets real judged
  // scores out of the box (a paid default judge silently 402s on empty
  // balances and would leave judged dimensions honestly-but-uselessly missing).
  {
    id: "openrouter/free",
    slug: "free-router",
    provider: "openrouter",
    name: "OpenRouter Free Router",
    displayName: "Free Router ($0)",
    version: "router",
    contextLength: 128000,
    maxOutputTokens: 8192,
    pricing: { prompt: 0, completion: 0, currency: "USD" },
    capabilities: ["text", "json-mode", "reasoning", "multilingual"],
    status: "active",
    description: "Routes to an available free model. Used as the default evaluator judge â€” $0 scoring for credit-free accounts.",
    openRouterId: "openrouter/free",
  },
];

export function getModelById(id: string): ModelConfig | undefined {
  return modelRegistry.find((m) => m.id === id || m.slug === id);
}

export function getModelsByProvider(provider: ModelProvider): ModelConfig[] {
  return modelRegistry.filter((m) => m.provider === provider);
}

export function getActiveModels(): ModelConfig[] {
  return modelRegistry.filter((m) => m.status === "active");
}

export function getModelsByCapability(capability: ModelCapability): ModelConfig[] {
  return modelRegistry.filter((m) => m.capabilities.includes(capability));
}

export function formatPricing(pricing: ModelPricing): string {
  return `$${pricing.prompt}/$${pricing.completion} per 1M tokens`;
}

export function estimateCost(modelId: string, promptTokens: number, completionTokens: number): number {
  const model = getModelById(modelId);
  if (!model) return 0;
  return (promptTokens / 1_000_000) * model.pricing.prompt + (completionTokens / 1_000_000) * model.pricing.completion;
}

export const providerLabels: Record<ModelProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  meta: "Meta",
  alibaba: "Alibaba",
  google: "Google",
  mistral: "Mistral",
  deepseek: "DeepSeek",
  xai: "xAI",
  cohere: "Cohere",
  perplexity: "Perplexity",
  openrouter: "OpenRouter",
};

export const modelSlugsToOpenRouterId: Record<string, string> = Object.fromEntries(
  modelRegistry.map((m) => [m.slug, m.openRouterId])
);
