import { NextRequest, NextResponse } from "next/server";
import { getModelById, type ModelConfig } from "@/lib/ai/models";
import { createProvider, type AIProvider, type GenerationRequest, type GenerationResponse, type ProviderKind } from "@/lib/ai/providers";
import { runEvaluationPipeline, type ExperimentRunConfig, type EvaluationDimension, type EvaluationMetricScores, type PipelineProgress } from "@/lib/ai/evaluator";
import { aggregateRunStatus, aggregatePerModel, type RunStatusKind } from "@/lib/ai/runAggregation";
import { datasetRepository } from "@/lib/datasets/repository";
import { experimentRepository } from "@/lib/experiments/repository";
import { runsRepository } from "@/lib/runs/repository";
import type { EvaluationRunMode } from "@/lib/evaluations/types";
import type { ExperimentMetrics } from "@/types";
import { requireCurrentUser } from "@/lib/auth/api";
import { resolveUserModel } from "@/lib/models/custom";

// Request: 1 dataset × N models × M test cases
export interface EvaluationRunRequest {
  experimentId?: string;
  datasetId: string;
  modelIds: string[];
  systemPrompt?: string;
  userPrompt: string; // must contain {{input}} or {{question}}
  temperature?: number;
  maxTokens?: number;
  judgeModelId?: string;
  dimensions?: string[];
  limitCases?: number; // TEST-ONLY hook (2-10); production runs evaluate ALL cases when omitted
  /**
   * When true the response is an SSE stream of events: `started` -> repeated
   * `progress` -> `status` -> `done`, so the UI can show genuinely live
   * progress. Defaults to false (plain JSON, fully backward compatible).
   */
  stream?: boolean;
  /** TEST-ONLY hook: force these modelIds to fail with `failStatusCode`. */
  failModelIds?: string[];
  failStatusCode?: number;
}

export interface EvaluationRunResponse {
  status: RunStatusKind;
  runId?: string;
  experimentId: string;
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    model: string;
    testCaseId: string;
    input: string;
    output: string;
    expectedOutput: string;
    status: "success" | "error";
    latency: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number | null;
    error?: string;
    code?: string;
    scores?: Record<string, number>;
  }>;
  aggregated?: Array<{ modelId: string; avgAccuracy: number; totalCost: number; successRate: number }>;
  errors?: Array<{ modelId: string; testCaseId: string; message: string; code?: string }>;
  error?: string;
  code?: string;
}

export type RunCompletedPayload = { json: EvaluationRunResponse & { runId: string }; httpStatus: number };

export type StreamEmit = (type: "progress", data: PipelineProgress & { successful?: number; failed?: number }) => void;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Flatten EvaluationMetricScores (nullable fields) into a Record<string, number> for storage. */
function scoresToRecord(s?: EvaluationMetricScores): Record<string, number> | undefined {
  if (!s) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === "number") out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Derive real experiment-level metrics from actual successful evaluations.
 * Faithfulness/relevance/hallucination/safety are averaged only when real
 * judge scores exist; missing dimensions are omitted, NEVER fabricated or
 * substituted with synthetic defaults.
 */
function computeRealMetrics(
  successResults: Array<{ scores?: Record<string, number>; latency: number; estimatedCost: number | null }>
): { accuracy: number; faithfulness?: number; relevance?: number; hallucination?: number; completeness?: number; toxicity?: number; bias?: number; latency: number; cost: number; safety?: number } | undefined {
  if (successResults.length === 0) return undefined;
  const avg = (key: string): number | undefined => {
    const vals = successResults
      .map((r) => r.scores?.[key])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : undefined;
  };
  const out: Record<string, number> = {};
  for (const key of ["accuracy", "faithfulness", "relevance", "hallucination", "completeness", "toxicity", "bias", "safety"] as const) {
    const v = avg(key);
    if (v !== undefined) out[key] = Number(v.toFixed(4));
  }
  out.latency = Math.round(successResults.reduce((s, r) => s + r.latency, 0) / successResults.length);
  out.cost = successResults.reduce((s, r) => s + (r.estimatedCost ?? 0), 0);
  return out as { accuracy: number; faithfulness?: number; relevance?: number; hallucination?: number; completeness?: number; toxicity?: number; bias?: number; latency: number; cost: number; safety?: number };
}

/**
 * TEST-ONLY wrapper: transparently rethrows for selected modelIds so we can
 * exercise partial/complete failure and provider error codes (401/402/429/5xx)
 * without a real upstream. Never used unless `failModelIds` is explicitly sent.
 */
function withSimulatedFailures(provider: AIProvider, failModelIds: string[], failStatusCode: number): AIProvider {
  if (failModelIds.length === 0) return provider;
  const upstreamCode = failStatusCode > 0 ? failStatusCode : 502;
  const shouldFail = (modelId: string) =>
    failModelIds.some((f) => {
      if (modelId === f || modelId.endsWith(`/${f}`)) return true;
      // Resolve by canonical slug/id — handles openRouterIds that differ from
      // the slug, including :free/:beta suffix variants (e.g. slug
      // "dots-3-note-preview" -> openRouterId
      // "dots-studio/dots-3-note-preview:free").
      const base = modelId.replace(/:(free|beta|nightly|extended)$/, "");
      if (base === f) return true;
      const byId = getModelById(base);
      return byId !== undefined && (byId.slug === f || byId.id === f);
    });
  const generateOne = async (request: GenerationRequest): Promise<GenerationResponse> => {
    if (shouldFail(request.modelId)) {
      throw new Error(`SimulatedOpenRouterError ${upstreamCode}: forced failure for ${request.modelId}`);
    }
    return provider.generate(request);
  };
  return {
    kind: provider.kind,
    isAvailable: () => provider.isAvailable(),
    generate: generateOne,
    generateBatch: async (requests) => {
      const out: GenerationResponse[] = [];
      for (const r of requests) out.push(await generateOne(r));
      return out;
    },
  };
}

interface FinalizeParams {
  runId: string;
  experimentId: string;
  ownerId: string;
  config: ExperimentRunConfig;
  provider: AIProvider;
}

/**
 * Runs the pipeline, persists live progress into the run record as tasks
 * complete, finalizes the run + experiment, and returns the response payload.
 * In stream mode `emit` relays progress events; otherwise it is a no-op.
 */
async function finalizeRun(params: FinalizeParams, emit?: StreamEmit): Promise<RunCompletedPayload> {
  const { runId, experimentId, ownerId, config, provider } = params;
  const total = config.dataset.testCases.length * config.models.length;
  let liveOk = 0;
  let liveFail = 0;

  // Serialize all writes to the run row so a fire-and-forget live progress
  // update can never land in the DB AFTER the authoritative final write and
  // clobber the persisted successful/failed counts (which previously produced
  // a correct results table but a stale/incorrect run header). Every write to
  // the run row goes through this single ordered queue, so the final write
  // (from finalizeResult) is always applied last.
  let writeQueue: Promise<unknown> = Promise.resolve();
  let finalized = false;
  const enqueueRunWrite = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = writeQueue.then(fn, fn);
    writeQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };

  const persistLive = () => {
    // Progress updates fire from a sync callback; persist asynchronously and
    // treat failures as non-fatal (final state is persisted below). Never fire
    // after the run has been finalized so stale numbers can't overwrite truth.
    if (finalized) return;
    const ok = liveOk;
    const fail = liveFail;
    enqueueRunWrite(() =>
      runsRepository
        .updateRun(runId, { status: "running", total, successful: ok, failed: fail })
        .then(() => undefined)
    );
    // Mirror live progress onto the experiment so list/detail pages reflect
    // the real running state (0 → 100%) instead of a stale status.
    const done = ok + fail;
    void experimentRepository
      .updateExperiment(experimentId, ownerId, {
        status: "running",
        progress: Math.min(100, Math.round((done / Math.max(1, total)) * 100)),
        completedTestCases: ok,
        totalTestCases: total,
      })
      .catch(() => {});
  };

  try {
    const { modelResults, evaluations, errors: rawPipelineErrors } = await runEvaluationPipeline(
      config,
      provider,
      (p: PipelineProgress) => {
        if (p.phase === "done") return; // final state arrives as our own event
        persistLive();
        emit?.("progress", { ...p, successful: liveOk, failed: liveFail });
      },
      (t) => {
        if (t.ok) liveOk++;
        else liveFail++;
      }
    );
    const pipelineErrors = rawPipelineErrors.filter((e): e is NonNullable<typeof e> => Boolean(e));

    const successResults = modelResults.map((mr) => {
      const ev = evaluations.find((e) => e.testCaseId === mr.testCaseId && e.modelId === mr.modelId);
      return {
        model: mr.modelId,
        testCaseId: mr.testCaseId,
        input: mr.input,
        output: mr.output,
        expectedOutput: mr.expectedOutput,
        status: "success" as const,
        latency: mr.latencyMs,
        promptTokens: mr.usage.promptTokens,
        completionTokens: mr.usage.completionTokens,
        totalTokens: mr.usage.totalTokens,
        estimatedCost: mr.cost,
        scores: scoresToRecord(ev?.scores),
      };
    });

    // Add failed as error results
    const failedResults = pipelineErrors.map((e) => ({
      model: e.modelId,
      testCaseId: e.testCaseId,
      input: config.dataset.testCases.find((t) => t.id === e.testCaseId)?.input || "",
      output: "",
      expectedOutput: config.dataset.testCases.find((t) => t.id === e.testCaseId)?.expectedOutput || "",
      status: "error" as const,
      latency: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: null,
      error: e.message,
      code: e.code,
      scores: undefined as Record<string, number> | undefined,
    }));

    const all = [...successResults, ...failedResults];

    // Overall status and counts come from the SAME canonical aggregation over
    // the per-execution results, so the persisted run header can never disagree
    // with the results table. An execution is successful iff its status is
    // "success"; every provider/eval failure is "error" and never counts.
    const summary = aggregateRunStatus(all);
    const successful = summary.successful;
    const failed = summary.failed;
    const status: RunStatusKind = summary.status;

    // Per-model aggregation: success is derived from that model's own results;
    // accuracy averages only successful results that carry a real numeric score.
    const perModel = aggregatePerModel(all);
    const aggregated = perModel.map((m) => ({
      modelId: m.modelId,
      avgAccuracy: m.avgAccuracy ?? 0,
      totalCost: m.totalCost,
      successRate: m.successRate,
    }));

    // Update run status based on results. Flush any in-flight live progress
    // writes first, then apply this authoritative state as the final write so
    // its successful/failed counts and results can never be overwritten by a
    // stale live update.
    finalized = true;
    await enqueueRunWrite(() =>
      runsRepository.updateRun(runId, {
        status: status === "success" ? "completed" : status === "partial" ? "partial" : "failed",
        total,
        successful,
        failed,
        completedAt: new Date().toISOString(),
        aggregated,
        errors: pipelineErrors.map((e) => ({ modelId: e.modelId, testCaseId: e.testCaseId, message: e.message, code: e.code })),
        results: all,
      })
    );

    // Also update experiment record (scoped to the run's owner)
    const existing = await experimentRepository.getExperiment(experimentId, ownerId);
    if (existing) {
      await experimentRepository.updateExperiment(experimentId, ownerId, {
        status: status === "success" ? "completed" : status === "partial" ? "completed" : "failed",
        progress: 100,
        completedTestCases: successful,
        totalTestCases: total,
        evaluationRunId: runId,
        metrics: computeRealMetrics(successResults) as ExperimentMetrics | undefined,
      });
    } else {
      await experimentRepository.createExperiment({
        id: experimentId,
        ownerId,
        name: `Experiment ${experimentId.slice(0, 8)}`,
        description: `Run on ${config.dataset.name} with ${config.models.length} models`,
        datasetId: config.dataset.id,
        datasetName: config.dataset.name,
        models: config.models.map((m) => m.id),
        modelNames: config.models.map((m) => m.displayName),
        promptTemplate: config.userPromptTemplate,
        systemPrompt: config.systemPrompt,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        judgeModelId: config.judgeModelId,
        status: status === "success" ? "completed" : "failed",
        progress: 100,
        totalTestCases: total,
        completedTestCases: successful,
        metrics: computeRealMetrics(successResults) as ExperimentMetrics | undefined,
        evaluationRunId: runId,
      });
    }

    return {
      json: {
        status,
        runId,
        experimentId,
        total,
        successful,
        failed,
        results: all,
        aggregated,
        errors: pipelineErrors.map((e) => ({ modelId: e.modelId, testCaseId: e.testCaseId, message: e.message, code: e.code })),
      } satisfies EvaluationRunResponse & { runId: string },
      httpStatus: failed === total ? 500 : 200,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    // Update run to failed state on exception (flushed last so stale live
    // progress writes can't overwrite the terminal state).
    finalized = true;
    try { await enqueueRunWrite(() => runsRepository.updateRun(runId, { status: "failed", completedAt: new Date().toISOString() }).then(() => undefined)); } catch /* istanbul ignore next */ { /* no-op */ }
    // Mirror the failure on the experiment so it is never stuck in "running".
    try {
      await experimentRepository.updateExperiment(experimentId, ownerId, {
        status: "failed",
        progress: Math.min(100, Math.round(((liveOk + liveFail) / Math.max(1, total)) * 100)),
        completedTestCases: liveOk,
        totalTestCases: total,
      });
    } catch /* istanbul ignore next */ { /* no-op */ }
    return { json: { status: "error", runId, experimentId, total: 0, successful: 0, failed: 0, results: [], error: msg.slice(0, 500), code: "INTERNAL" }, httpStatus: 500 };
  }
}

/**
 * Wraps execution in an SSE response while keeping the exact same JSON payload
 * in the final `done` event, so stream clients and JSON clients agree.
 */
async function startEventStream(runId: string, run: (emit?: StreamEmit) => Promise<RunCompletedPayload>): Promise<Response> {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      };
      try {
        send("started", { runId });
        const { json, httpStatus } = await run((type, data) => {
          if (type === "progress") send("progress", data);
        });
        send("status", { httpStatus });
        send("done", { ...json, httpStatus });
      } catch {
        send("error", { error: "Internal error while running evaluation", code: "INTERNAL" });
      } finally {
        try { controller.close(); } catch { /* no-op */ }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Malformed JSON", code: "INVALID_JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const datasetId = b.datasetId as string;
  const modelIds = b.modelIds as string[];
  const userPrompt = b.userPrompt as string;
  const systemPrompt = b.systemPrompt as string | undefined;
  const temperature = b.temperature as number | undefined;
  const maxTokens = b.maxTokens as number | undefined;
  const judgeModelId = (b.judgeModelId as string) || "openrouter/free";
  const limitCases = b.limitCases as number | undefined;

  if (!isNonEmptyString(datasetId)) return NextResponse.json({ status: "error", error: "datasetId required" }, { status: 400 });
  if (!Array.isArray(modelIds) || modelIds.length === 0) return NextResponse.json({ status: "error", error: "modelIds must be non-empty array" }, { status: 400 });
  if (!isNonEmptyString(userPrompt)) return NextResponse.json({ status: "error", error: "userPrompt required" }, { status: 400 });
  if (temperature !== undefined && (typeof temperature !== "number" || temperature < 0 || temperature > 2)) return NextResponse.json({ status: "error", error: "temperature 0-2" }, { status: 400 });
  if (maxTokens !== undefined && (typeof maxTokens !== "number" || maxTokens <= 0 || maxTokens > 128000)) return NextResponse.json({ status: "error", error: "maxTokens 1-128000" }, { status: 400 });

  const dataset = await datasetRepository.getDataset(datasetId, auth.user.id);
  if (!dataset) return NextResponse.json({ status: "error", error: "DATASET_NOT_FOUND", code: "DATASET_NOT_FOUND" }, { status: 404 });
  if (!dataset.cases || dataset.cases.length === 0) {
    return NextResponse.json({ status: "error", error: "NO_TEST_CASES", code: "NO_TEST_CASES", message: "Dataset has no test cases. Add test cases before running evaluation." }, { status: 400 });
  }

  const models: ModelConfig[] = [];
  for (const id of modelIds) {
    const m = getModelById(id) ?? (await resolveUserModel(auth.user.id, id));
    if (!m) {
      return NextResponse.json({ status: "error", error: `MODEL_NOT_FOUND: ${id}`, code: "MODEL_NOT_FOUND" }, { status: 400 });
    }
    if (!m.openRouterId || !m.openRouterId.trim()) {
      return NextResponse.json({ status: "error", error: `MODEL_NOT_CONFIGURED: ${id} has no OpenRouter ID`, code: "MODEL_NOT_CONFIGURED" }, { status: 400 });
    }
    models.push(m);
  }
  if (models.length === 0) return NextResponse.json({ status: "error", error: "No valid models found" }, { status: 400 });

  const judge = getModelById(judgeModelId) ?? (await resolveUserModel(auth.user.id, judgeModelId));
  if (!judge || !judge.openRouterId || !judge.openRouterId.trim()) {
    return NextResponse.json({ status: "error", error: `JUDGE_MODEL_NOT_FOUND: ${judgeModelId}`, code: "JUDGE_MODEL_NOT_FOUND" }, { status: 400 });
  }

  const available = dataset.cases;
  // Production runs evaluate ALL test cases. limitCases is a TEST-ONLY hook
  // (2-10) that must be explicitly provided — it is never applied by default.
  const count =
    limitCases !== undefined && Number.isFinite(limitCases)
      ? Math.min(Math.max(2, Math.floor(limitCases)), available.length)
      : available.length;
  const testCases = available.slice(0, count);

  const experimentId = (b.experimentId as string) || `exp_${Date.now()}`;

  // When an experiment id is supplied it must belong to this user (safe 404).
  let experimentExists = false;
  if (b.experimentId) {
    if (!(await experimentRepository.getExperiment(experimentId, auth.user.id))) {
      return NextResponse.json({ status: "error", error: "EXPERIMENT_NOT_FOUND", code: "EXPERIMENT_NOT_FOUND" }, { status: 404 });
    }
    experimentExists = true;
    // Prevent duplicate simultaneous runs: reject when a run is still running
    // for the same experiment and owner. A re-run must start once the previous
    // run has reached a terminal state (completed / partial / failed).
    const activeRuns = await runsRepository.getRunsByExperiment(experimentId, auth.user.id);
    if (activeRuns.some((r) => r.status === "running")) {
      return NextResponse.json(
        { status: "error", error: "RUN_ALREADY_ACTIVE", code: "RUN_ALREADY_ACTIVE", message: "This experiment already has a running evaluation. Wait for it to finish before starting another." },
        { status: 409 }
      );
    }
  }

  const config: ExperimentRunConfig = {
    experimentId,
    dataset: { id: datasetId, name: dataset.name, version: dataset.version, testCases },
    models,
    systemPrompt,
    userPromptTemplate: userPrompt,
    temperature: temperature ?? 0.7,
    maxTokens: maxTokens ?? 512,
    judgeModelId,
    dimensions: ((b.dimensions as string[]) ?? ["accuracy", "latency", "cost"]) as EvaluationDimension[],
  };

  // Provider mode: explicit override ("mock"/"openrouter") or auto-detect
  // ("auto", the default — real provider when a key is configured).
  const providerKind = b.providerKind as string | undefined;
  const forceProvider: ProviderKind | undefined =
    providerKind === "mock" || providerKind === "openrouter" ? providerKind : undefined;
  const provider = createProvider(forceProvider ? { kind: forceProvider } : undefined);
  const failModelIds = Array.isArray(b.failModelIds) ? b.failModelIds.filter((x): x is string => typeof x === "string") : [];
  const failStatusCode = typeof b.failStatusCode === "number" ? b.failStatusCode : 0;
  const effectiveProvider = withSimulatedFailures(provider, failModelIds, failStatusCode);
  const mode: EvaluationRunMode = provider.kind === "openrouter" ? "openrouter" : "mock";

  // Create run with "running" status BEFORE execution starts
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await runsRepository.createRun({
    id: runId,
    ownerId: auth.user.id,
    experimentId,
    datasetId,
    datasetName: dataset.name,
    mode,
    modelIds,
    modelNames: models.map((m) => m.displayName),
    promptTemplate: userPrompt,
    systemPrompt,
    temperature: temperature ?? 0.7,
    maxTokens: maxTokens ?? 512,
    judgeModelId,
    results: [],
    aggregated: [],
    errors: [],
    status: "running",
    total: testCases.length * models.length,
    successful: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
  });

  // Reflect the running state on the experiment immediately so the list and
  // detail pages show live progress (and reruns are correctly blocked).
  if (experimentExists) {
    await experimentRepository.updateExperiment(experimentId, auth.user.id, {
      status: "running",
      progress: 0,
      completedTestCases: 0,
      totalTestCases: testCases.length * models.length,
    });
  }

  const finalize = (emit?: StreamEmit): Promise<RunCompletedPayload> =>
    finalizeRun({ runId, experimentId, ownerId: auth.user.id, config, provider: effectiveProvider }, emit);

  if (b.stream === true) return startEventStream(runId, finalize);

  const { json, httpStatus } = await finalize();
  return NextResponse.json(json, { status: httpStatus });
}

export async function GET() {
  return NextResponse.json({ status: "error", error: "Use POST" }, { status: 405 });
}