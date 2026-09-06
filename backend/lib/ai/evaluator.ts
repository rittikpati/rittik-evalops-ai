import type { ModelConfig } from "./models";
import { getModelById } from "./models";
import type { AIProvider, GenerationRequest } from "./providers";
import { isProviderError } from "./providers";

// ---------------------------------------------------------------------------
// Core Types â€” keep in sync with @/types but richer for pipeline
// ---------------------------------------------------------------------------

export type EvaluationDimension =
  | "accuracy"
  | "faithfulness"
  | "relevance"
  | "hallucination"
  | "completeness"
  | "toxicity"
  | "bias"
  | "latency"
  | "cost"
  | "safety";

/**
 * Metrics that are produced by the judge (LLM/heuristic) as opposed to real
 * telemetry (latency/cost). Kept in canonical order for UI column ordering.
 */
export const JUDGED_DIMENSIONS: EvaluationDimension[] = [
  "accuracy",
  "relevance",
  "faithfulness",
  "hallucination",
  "completeness",
  "toxicity",
  "bias",
  "safety",
] as const;

export interface TestCase {
  id: string;
  datasetId: string;
  /** User-visible prompt/question */
  input: string;
  /** Ground truth */
  expectedOutput: string;
  /** Optional RAG context */
  context?: string;
  metadata?: Record<string, unknown>;
  /** Original row index */
  index: number;
}

export interface DatasetSnapshot {
  id: string;
  name: string;
  version: string;
  testCases: TestCase[];
}

export interface ModelResult {
  id: string;
  testCaseId: string;
  datasetId: string;
  experimentId: string;
  modelId: string;
  modelName: string;
  provider: string;
  input: string;
  expectedOutput: string;
  context?: string;
  output: string;
  latencyMs: number;
  cost: number;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  createdAt: string;
}

export interface EvaluationMetricScores {
  accuracy: number | null; // 0-1 or null if no expectedOutput
  faithfulness: number | null; // null if no context
  relevance: number | null;
  hallucination: number | null; // 1 = no hallucination, 0 = severe, null if no context? (we keep 1-0)
  /** 0-1 how completely the output covers the expected answer, or null if no expectedOutput */
  completeness: number | null;
  /** 0-1 honest â€” 1 = non-toxic, 0 = toxic (derived from actual output text) */
  toxicity: number | null;
  /** 0-1 honest â€” 1 = unbiased, 0 = biased (derived from actual output text) */
  bias: number | null;
  latency: number; // ms â€” real, never null
  cost: number | null; // USD or null if unknown
  safety: number | null;
  confidence?: number;
}

export interface EvaluationResult {
  id: string;
  testCaseId: string;
  datasetId: string;
  experimentId: string;
  modelId: string;
  modelName: string;
  provider: string;
  input: string;
  expectedOutput: string;
  output: string;
  context?: string;
  scores: EvaluationMetricScores;
  judgeReason: string;
  judgeModelId: string;
  latencyMs: number;
  cost: number;
  createdAt: string;
}

export interface AggregatedMetrics {
  modelId: string;
  modelName: string;
  provider: string;
  count: number;
  avg: EvaluationMetricScores;
  p50LatencyMs: number;
  p95LatencyMs: number;
  totalCost: number;
}

export interface ExperimentRunConfig {
  experimentId: string;
  dataset: DatasetSnapshot;
  models: ModelConfig[];
  systemPrompt?: string;
  userPromptTemplate: string; // must contain {{input}} or {{question}}
  temperature?: number;
  maxTokens?: number;
  judgeModelId: string;
  dimensions: EvaluationDimension[];
}

export interface PipelineProgress {
  phase: "loading" | "executing" | "evaluating" | "aggregating" | "done" | "error";
  completed: number;
  total: number;
  currentModelId?: string;
  currentTestCaseId?: string;
  message?: string;
}

export type ProgressCallback = (p: PipelineProgress) => void;

/**
 * Per-task outcome fired as soon as a single model Ã— test-case execution
 * resolves, so callers can track live running totals (successful/failed)
 * before the whole pipeline finishes.
 */
export interface TaskResult {
  modelId: string;
  testCaseId: string;
  ok: boolean;
  message?: string;
  code?: string;
}

export type TaskResultCallback = (result: TaskResult) => void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPrompt(template: string, testCase: TestCase): string {
  return template
    .replaceAll("{{input}}", testCase.input)
    .replaceAll("{{question}}", testCase.input)
    .replaceAll("{{context}}", testCase.context || "")
    .replaceAll("{{expected}}", testCase.expectedOutput);
}

function hashForScore(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (Math.abs(h) % 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Mock Judge â€” now delegates to backend/lib/ai/judge.ts MockJudge for extensibility
// ---------------------------------------------------------------------------
// Re-export for backwards compatibility, but new code should use createJudge
export { MockJudge, OpenRouterJudge, createJudge } from "./judge";
import { createJudge, type JudgeMetric } from "./judge";

export async function mockJudge(
  testCase: TestCase,
  modelOutput: string,
  modelId: string,
  judgeModelId: string
): Promise<{ scores: EvaluationMetricScores; reason: string }> {
  const judge = createJudge("mock");
  // Judge each dimension separately for proper null handling
  const dims: Array<EvaluationDimension> = [...JUDGED_DIMENSIONS];
  const results = await Promise.all(
    dims.map((metric) =>
      judge.judge({
        testCase,
        modelOutput,
        modelId,
        metric: metric as JudgeMetric,
        expectedOutput: testCase.expectedOutput,
        context: testCase.context,
      })
    )
  );
  const map = Object.fromEntries(dims.map((d, i) => [d, results[i]])) as Record<string, { score: number | null; reason: string }>;
  // Latency/cost are real, not judged â€” use deterministic mock based on model output hash
  const base = hashForScore(testCase.id + modelId);
  const latency = 600 + Math.round(hashForScore(modelOutput + "lat") * 1800);
  const cost = 0.001 + hashForScore(modelOutput + "cost") * 0.008;
  const reason = map.accuracy.reason || map.relevance.reason || "Mock evaluation";

  return {
    scores: {
      accuracy: map.accuracy.score,
      relevance: map.relevance.score,
      faithfulness: map.faithfulness.score,
      hallucination: map.hallucination.score,
      completeness: map.completeness.score,
      toxicity: map.toxicity.score,
      bias: map.bias.score,
      safety: map.safety.score,
      latency,
      cost,
      confidence: 0.84,
    },
    reason,
  };
}

// Keep sync version for backwards compat (now async, but we provide sync wrapper)
function hashForScoreSync(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (Math.abs(h) % 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Pipeline Functions â€” pure, testable, no UI coupling
// ---------------------------------------------------------------------------

export interface ExecutionResult {
  result?: ModelResult;
  error?: { testCaseId: string; modelId: string; message: string; code?: string };
}

export async function executeModels(
  config: ExperimentRunConfig,
  provider: AIProvider,
  onProgress?: ProgressCallback,
  onTaskResult?: TaskResultCallback
): Promise<{ results: ModelResult[]; errors: ExecutionResult["error"][] }> {
  const total = config.dataset.testCases.length * config.models.length;
  let completed = 0;
  const results: ModelResult[] = [];
  const errors: ExecutionResult["error"][] = [];

  // Build all tasks: 1 dataset Ã— N models Ã— M test cases = N*M executions
  const tasks: Array<{ model: ModelConfig; tc: TestCase }> = [];
  for (const model of config.models) {
    for (const tc of config.dataset.testCases) {
      tasks.push({ model, tc });
    }
  }

  // Concurrency limit â€” avoid firing unlimited requests
  const concurrency = 4;
  for (let i = 0; i < tasks.length; i += concurrency) {
    const chunk = tasks.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(async ({ model, tc }) => {
        const prompt = renderPrompt(config.userPromptTemplate, tc);
        const req: GenerationRequest = {
          modelId: model.openRouterId || model.id,
          systemPrompt: config.systemPrompt,
          prompt,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          testCaseId: tc.id,
        };

        onProgress?.({
          phase: "executing",
          completed,
          total,
          currentModelId: model.id,
          currentTestCaseId: tc.id,
          message: `Running ${model.displayName} on ${tc.id}`,
        });

        try {
          const res = await provider.generate(req);

          // Validate real (OpenRouter) responses: an empty/null output must
          // be treated as a failed evaluation, not a successful one. This
          // prevents empty AI responses from being scored as if valid.
          if (provider.kind === "openrouter" && (!res.content || !res.content.trim())) {
            const message = `OpenRouter returned an empty response for ${model.displayName} (${tc.id}).`;
            errors.push({ testCaseId: tc.id, modelId: model.id, message: message.slice(0, 500), code: "EMPTY_RESPONSE" });
            onTaskResult?.({ modelId: model.id, testCaseId: tc.id, ok: false, message: message.slice(0, 500), code: "EMPTY_RESPONSE" });
            return { ok: false as const, error: message };
          }

          const mr: ModelResult = {
            id: `${config.experimentId}:${model.id}:${tc.id}`,
            testCaseId: tc.id,
            datasetId: config.dataset.id,
            experimentId: config.experimentId,
            modelId: model.id,
            modelName: model.displayName,
            provider: model.provider,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            context: tc.context,
            output: res.content,
            latencyMs: res.latencyMs,
            cost: res.cost,
            usage: res.usage,
            createdAt: res.createdAt,
          };
          results.push(mr);
          onTaskResult?.({ modelId: model.id, testCaseId: tc.id, ok: true });
          return { ok: true as const };
        } catch (err: unknown) {
          let code = "UPSTREAM_ERROR";
          let friendlyMessage: string;
          if (isProviderError(err)) {
            code = err.code;
            friendlyMessage = err.safeMessage;
          } else {
            const message = err instanceof Error ? err.message : "Unknown error";
            // Fallback for non-ProviderError exceptions (network, etc.)
            const lower = message.toLowerCase();
            if (lower.includes("401") || lower.includes("unauthorized")) { code = "AUTH_ERROR"; friendlyMessage = "Authentication failed â€” check your OpenRouter API key."; }
            else if (lower.includes("402") || lower.includes("insufficient")) { code = "INSUFFICIENT_CREDITS"; friendlyMessage = "Insufficient OpenRouter credits. Add funds at openrouter.ai/credits."; }
            else if (lower.includes("429") || lower.includes("rate limit")) { code = "RATE_LIMIT"; friendlyMessage = "Rate limited by OpenRouter. Retries were exhausted â€” wait a moment before trying again."; }
            else if (lower.includes("403") || lower.includes("forbidden")) { code = "FORBIDDEN"; friendlyMessage = "Access denied â€” your API key may lack permission for this model."; }
            else if (lower.includes("404") || lower.includes("not found")) { code = "MODEL_NOT_FOUND"; friendlyMessage = "The model was not found on OpenRouter."; }
            else if (lower.includes("timed out") || lower.includes("timeout")) { code = "TIMEOUT"; friendlyMessage = "Request timed out. The model may be overloaded â€” try again."; }
            else if (lower.includes("400") || lower.includes("invalid")) { code = "INVALID_REQUEST"; friendlyMessage = "The model request was invalid. Check the prompt and parameters."; }
            else { friendlyMessage = `Execution failed: ${message.slice(0, 120)}`; }
          }
          errors.push({ testCaseId: tc.id, modelId: model.id, message: friendlyMessage.slice(0, 500), code });
          onTaskResult?.({ modelId: model.id, testCaseId: tc.id, ok: false, message: friendlyMessage.slice(0, 500), code });
          // Still count as completed for progress, but not as successful result
          return { ok: false as const, error: friendlyMessage };
        } finally {
          completed++;
          onProgress?.({
            phase: "executing",
            completed,
            total,
            currentModelId: model.id,
            currentTestCaseId: tc.id,
          });
        }
      })
    );
    // Ensure we don't overwhelm â€” small delay between chunks
    if (i + concurrency < tasks.length) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  return { results, errors };
}

export async function evaluateResults(
  modelResults: ModelResult[],
  judgeModelId: string,
  providerKind: "mock" | "openrouter" = "mock",
  onProgress?: ProgressCallback,
  dimensions?: EvaluationDimension[]
): Promise<EvaluationResult[]> {
  const total = modelResults.length;
  const evaluations: EvaluationResult[] = [];

  // Create judge based on provider kind â€” auto-fallback handled inside OpenRouterJudge
  const judge = createJudge(providerKind, judgeModelId);

  // Judge exactly the requested scored dimensions (default: all judged metrics).
  // Latency/cost are real telemetry and are always recorded regardless.
  const judged = (dimensions && dimensions.length > 0 ? dimensions : [...JUDGED_DIMENSIONS]).filter((d) =>
    (JUDGED_DIMENSIONS as string[]).includes(d)
  ) as Array<EvaluationDimension>;

  for (let i = 0; i < modelResults.length; i++) {
    const mr = modelResults[i];
    onProgress?.({
      phase: "evaluating",
      completed: i,
      total,
      currentModelId: mr.modelId,
      currentTestCaseId: mr.testCaseId,
    });

    const tc: TestCase = {
      id: mr.testCaseId,
      datasetId: mr.datasetId,
      input: mr.input,
      expectedOutput: mr.expectedOutput,
      context: mr.context,
      index: i,
    };

    // Judge each selected dimension â€” handles null for missing expectedOutput/context
    const judgeResults = await Promise.all(
      judged.map((metric) =>
        judge.judge({
          testCase: tc,
          modelOutput: mr.output,
          modelId: mr.modelId,
          metric: metric as JudgeMetric,
          expectedOutput: tc.expectedOutput,
          context: tc.context,
        })
      )
    );
    const scoreMap = Object.fromEntries(judged.map((d, idx) => [d, judgeResults[idx].score])) as Record<string, number | null>;
    const reason = judgeResults.find((r) => r.reason && r.reason !== "Not applicable")?.reason || judgeResults[0]?.reason || "Evaluated";

    // Latency/cost are real from model execution, not judged
    const scores: EvaluationMetricScores = {
      accuracy: scoreMap.accuracy ?? null,
      relevance: scoreMap.relevance ?? null,
      faithfulness: scoreMap.faithfulness ?? null,
      hallucination: scoreMap.hallucination ?? null,
      completeness: scoreMap.completeness ?? null,
      toxicity: scoreMap.toxicity ?? null,
      bias: scoreMap.bias ?? null,
      safety: scoreMap.safety ?? null,
      latency: mr.latencyMs,
      cost: mr.cost,
    };

    evaluations.push({
      id: `eval:${mr.id}`,
      testCaseId: mr.testCaseId,
      datasetId: mr.datasetId,
      experimentId: mr.experimentId,
      modelId: mr.modelId,
      modelName: mr.modelName,
      provider: mr.provider,
      input: mr.input,
      expectedOutput: mr.expectedOutput,
      output: mr.output,
      context: mr.context,
      scores,
      judgeReason: reason,
      judgeModelId,
      latencyMs: mr.latencyMs,
      cost: mr.cost,
      createdAt: new Date().toISOString(),
    });
  }

  return evaluations;
}

export function aggregateMetrics(evaluations: EvaluationResult[]): AggregatedMetrics[] {
  const byModel = new Map<string, EvaluationResult[]>();
  for (const e of evaluations) {
    const arr = byModel.get(e.modelId) || [];
    arr.push(e);
    byModel.set(e.modelId, arr);
  }

  return Array.from(byModel.entries()).map(([modelId, list]) => {
    const count = list.length;
    // Handle null correctly â€” average only available, not treating null as 0
    const avg: EvaluationMetricScores = {
      accuracy: avgOfNullable(list, (x) => x.scores.accuracy),
      faithfulness: avgOfNullable(list, (x) => x.scores.faithfulness),
      relevance: avgOfNullable(list, (x) => x.scores.relevance),
      hallucination: avgOfNullable(list, (x) => x.scores.hallucination),
      completeness: avgOfNullable(list, (x) => x.scores.completeness),
      toxicity: avgOfNullable(list, (x) => x.scores.toxicity),
      bias: avgOfNullable(list, (x) => x.scores.bias),
      safety: avgOfNullable(list, (x) => x.scores.safety),
      latency: avgOf(list, (x) => x.scores.latency),
      cost: avgOfNullable(list, (x) => x.scores.cost) ?? 0,
    };
    // Also compute total/avg tokens and cost
    const latencies = list.map((x) => x.latencyMs).sort((a, b) => a - b);
    const p50 = percentile(latencies, 0.5);
    const p95 = percentile(latencies, 0.95);
    const totalCost = list.reduce((s, x) => s + (x.scores.cost ?? x.cost), 0);
    const first = list[0];
    return {
      modelId,
      modelName: first.modelName,
      provider: first.provider,
      count,
      avg,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      totalCost,
    };
  });
}

function avgOf<T>(arr: T[], fn: (x: T) => number): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, x) => s + fn(x), 0) / arr.length;
}

function avgOfNullable<T>(arr: T[], fn: (x: T) => number | null): number | null {
  const vals = arr.map(fn).filter((v): v is number => v !== null && v !== undefined);
  if (vals.length === 0) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export interface RankedModel extends AggregatedMetrics {
  overallScore: number;
  rank: number;
  strengths: string[];
  weaknesses: string[];
  costPer1k?: number;
}

const DEFAULT_WEIGHTS: Record<EvaluationDimension, number> = {
  accuracy: 0.3,
  relevance: 0.2,
  faithfulness: 0.12,
  hallucination: 0.12,
  completeness: 0.08,
  toxicity: 0.03,
  bias: 0.03,
  safety: 0.05,
  latency: 0.04,
  cost: 0.03,
};

export function rankModels(aggregated: AggregatedMetrics[], weights: Partial<Record<EvaluationDimension, number>> = {}): RankedModel[] {
  const w = { ...DEFAULT_WEIGHTS, ...weights } as Record<EvaluationDimension, number>;

  return aggregated
    .map((m) => {
      // Normalize weights for available metrics only
      const available: EvaluationDimension[] = [];
      const scores: Record<string, number> = {};
      // For each dimension, check if avg is not null
      (["accuracy", "relevance", "faithfulness", "hallucination", "completeness", "toxicity", "bias", "safety", "latency", "cost"] as EvaluationDimension[]).forEach((dim) => {
        const v = (m.avg as unknown as Record<string, number | null>)[dim];
        if (v !== null && v !== undefined) {
          available.push(dim);
          // Normalize latency/cost to 0-1 (lower is better) â€” invert
          if (dim === "latency") {
            // Assume 3000ms max
            scores[dim] = Math.max(0, 1 - v / 3000);
          } else if (dim === "cost") {
            scores[dim] = Math.max(0, 1 - v / 0.02);
          } else if (dim === "hallucination") {
            // Hallucination is already 1=no hall, 0=severe, so keep as is
            scores[dim] = v;
          } else {
            // accuracy/faithfulness/relevance/completeness/toxicity/bias/safety are already 0-1 higher-is-better
            scores[dim] = v;
          }
        }
      });

      const totalWeight = available.reduce((s, dim) => s + w[dim], 0);
      let overall = 0;
      if (totalWeight > 0) {
        for (const dim of available) {
          overall += (scores[dim] * w[dim]) / totalWeight;
        }
      }

      // Strengths/weaknesses based on relative scores
      const sortedDims = available.map((dim) => ({ dim, score: scores[dim] })).sort((a, b) => b.score - a.score);
      const strengths = sortedDims.slice(0, 2).map((d) => d.dim).filter((d) => scores[d] > 0.75);
      const weaknesses = sortedDims.slice(-2).map((d) => d.dim).filter((d) => scores[d] < 0.6);

      return {
        ...m,
        overallScore: Number(overall.toFixed(3)),
        rank: 0,
        strengths,
        weaknesses,
      };
    })
    .sort((a, b) => b.overallScore - a.overallScore)
    .map((m, idx) => ({ ...m, rank: idx + 1 }));
}

// ---------------------------------------------------------------------------
// High-level runner â€” Dataset -> Results
// ---------------------------------------------------------------------------

export function generateMockTestCases(datasetId: string, count: number, datasetName: string): TestCase[] {
  const samples = [
    { input: "What is the capital of France?", expected: "Paris", context: "Geography" },
    { input: "Explain quantum entanglement in simple terms.", expected: "Quantum entanglement is when two particles become linked...", context: "Physics" },
    { input: "Who wrote '1984'?", expected: "George Orwell", context: "Literature" },
    { input: "What is 2+2?", expected: "4", context: "Math" },
    { input: "Define photosynthesis.", expected: "Photosynthesis is the process by which plants convert light...", context: "Biology" },
  ];
  return Array.from({ length: count }, (_, i) => {
    const s = samples[i % samples.length];
    return {
      id: `${datasetId}-tc-${String(i + 1).padStart(3, "0")}`,
      datasetId,
      input: `${s.input} [${datasetName} #${i + 1}]`,
      expectedOutput: s.expected,
      context: `${s.context} â€” ${datasetName}`,
      metadata: { source: datasetName, index: i },
      index: i,
    };
  });
}

export async function runEvaluationPipeline(
  config: ExperimentRunConfig,
  provider: AIProvider,
  onProgress?: ProgressCallback,
  onTaskResult?: TaskResultCallback
): Promise<{ modelResults: ModelResult[]; evaluations: EvaluationResult[]; aggregated: AggregatedMetrics[]; errors: ExecutionResult["error"][] }> {
  onProgress?.({ phase: "loading", completed: 0, total: config.dataset.testCases.length * config.models.length, message: "Loading dataset" });

  const { results: modelResults, errors } = await executeModels(config, provider, onProgress, onTaskResult);
  onProgress?.({ phase: "evaluating", completed: 0, total: modelResults.length, message: "Judging outputs" });
  const evaluations = await evaluateResults(modelResults, config.judgeModelId, provider.kind, onProgress, config.dimensions);
  onProgress?.({ phase: "aggregating", completed: evaluations.length, total: evaluations.length, message: "Aggregating metrics" });
  const aggregated = aggregateMetrics(evaluations);
  onProgress?.({ phase: "done", completed: evaluations.length, total: evaluations.length, message: errors.length ? `Done with ${errors.length} failures` : "Done" });

  return { modelResults, evaluations, aggregated, errors };
}

