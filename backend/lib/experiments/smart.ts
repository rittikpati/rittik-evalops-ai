import type { ModelConfig } from "@/lib/ai/models";
import type { EvaluationRun } from "@/lib/evaluations/types";
import type { TestCase } from "@/types";

export interface PerModelCost {
  modelId: string;
  slug: string;
  displayName: string;
  free: boolean;
  cost: number;
}

export interface RunEstimate {
  cases: number;
  evalCount: number;
  modelCost: number;
  judgeCost: number;
  totalCost: number;
  minutes: number;
  perModel: PerModelCost[];
  judge: PerModelCost | null;
}

const AVG_PROMPT_BASE = 350;
const AVG_COMPLETION_BASE = 512;
const JUDGE_PROMPT = 650;
const JUDGE_COMPLETION = 220;
const EVAL_MS = 1750;
const JUDGE_MS = 850;

/**
 * Estimates token cost + wall time for a run from token prices, including
 * the judge's scoring round trips (the naive per-1K-completion estimate that
 * omits the judge under-reports by a large margin).
 */
export function estimateRunCost(input: {
  cases: number;
  modelIds: string[];
  models: ModelConfig[];
  judgeModelId: string;
  systemPrompt?: string;
  userPrompt?: string;
  maxTokens?: number;
}): RunEstimate {
  const { cases, modelIds, models } = input;
  const maxTokens = input.maxTokens ?? AVG_COMPLETION_BASE;
  const promptBase =
    AVG_PROMPT_BASE + Math.ceil(((input.systemPrompt?.length ?? 0) + (input.userPrompt?.length ?? 0)) / 4);

  const perModel: PerModelCost[] = modelIds
    .map((id) => {
      const m = models.find((x) => x.id === id || x.slug === id);
      if (!m) return null;
      const perCase = (promptBase / 1e6) * m.pricing.prompt + (maxTokens / 1e6) * m.pricing.completion;
      return {
        modelId: m.id,
        slug: m.slug,
        displayName: m.displayName,
        free: m.pricing.prompt + m.pricing.completion === 0,
        cost: perCase * cases,
      };
    })
    .filter((x): x is PerModelCost => x !== null);

  const judge = models.find((x) => x.id === input.judgeModelId || x.slug === input.judgeModelId) ?? null;
  const judgePerCase = judge
    ? (JUDGE_PROMPT / 1e6) * judge.pricing.prompt + (JUDGE_COMPLETION / 1e6) * judge.pricing.completion
    : 0;

  const evalCount = cases * modelIds.length;
  const jsMs = evalCount * judgePerCase > 0 ? JUDGE_MS * evalCount : 0;
  const totalMs = EVAL_MS * evalCount + jsMs;

  return {
    cases,
    evalCount,
    modelCost: perModel.reduce((s, p) => s + p.cost, 0),
    judgeCost: judgePerCase * evalCount,
    totalCost: perModel.reduce((s, p) => s + p.cost, 0) + judgePerCase * evalCount,
    minutes: totalMs / 60000,
    perModel,
    judge: judge
      ? {
          modelId: judge.id,
          slug: judge.slug,
          displayName: judge.displayName,
          free: judge.pricing.prompt + judge.pricing.completion === 0,
          cost: judgePerCase * evalCount,
        }
      : null,
  };
}

export interface DatasetHealth {
  total: number;
  labeled: number;
  unlabeled: number;
  emptyInputs: number;
  usable: boolean;
  accuracyReliable: boolean;
}

/** Inspects a dataset's cases for run-readiness (missing inputs / unlabeled answers). */
export function computeDatasetHealth(dataset: { cases?: TestCase[] } | undefined): DatasetHealth {
  const cases = dataset?.cases ?? [];
  const labeled = cases.filter((c) => c.expectedOutput && c.expectedOutput.trim().length > 0).length;
  const emptyInputs = cases.filter((c) => !c.input || !c.input.trim()).length;
  const total = cases.length;
  return {
    total,
    labeled,
    unlabeled: total - labeled,
    emptyInputs,
    usable: total > 0 && emptyInputs === 0,
    accuracyReliable: total > 0 && emptyInputs === 0 && labeled === total,
  };
}

/** Builds a file-safe-ish experiment name from the dataset + models. */
export function suggestExperimentName(datasetName: string, modelIds: string[], models: ModelConfig[]): string {
  const names = modelIds
    .map((id) => models.find((x) => x.id === id || x.slug === id)?.displayName)
    .filter((x): x is string => Boolean(x));
  const suffix = names.length > 0 ? ` · ${names.join(" + ")}` : "";
  return `${datasetName}${suffix}`;
}

export interface RunTrendPoint {
  label: string;
  accuracy: number;
  faithfulness: number;
  hallucination: number;
  cost: number;
}

/** Chronological accuracy/cost series across runs — powers the progress trend chart. */
export function runTrend(runs: EvaluationRun[]): RunTrendPoint[] {
  const sorted = [...runs].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  return sorted.map((r, i) => {
    const ok = r.results.filter((x) => x.status === "success");
    const n = ok.length;
    const avg = (key: keyof NonNullable<EvaluationRun["results"][number]["scores"]>) =>
      n ? ok.reduce((s, x) => s + (x.scores?.[key] ?? 0), 0) / n : 0;
    const agg = r.aggregated.length
      ? r.aggregated.reduce((s, a) => s + a.avgAccuracy, 0) / r.aggregated.length
      : undefined;
    return {
      label: `R${i + 1}`,
      accuracy: agg !== undefined ? agg : avg("accuracy"),
      faithfulness: avg("faithfulness"),
      hallucination: avg("hallucination"),
      cost: r.results.reduce((s, x) => s + (x.estimatedCost ?? 0), 0),
    };
  });
}

export interface ModelDelta {
  modelId: string;
  displayName: string;
  latest: number | null;
  previous: number | null;
  delta: number | null;
  episodes: number;
}

/** Per-model latest-vs-previous run accuracy deltas. */
export function modelDeltas(runs: EvaluationRun[], resolveName: (id: string) => string): ModelDelta[] {
  const sorted = [...runs].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  const byModel = new Map<string, number[]>();
  for (const run of sorted) {
    const perModel = new Map<string, number[]>();
    for (const x of run.results) {
      if (x.status !== "success") continue;
      const list = perModel.get(x.model) ?? [];
      list.push(x.scores?.accuracy ?? 0);
      perModel.set(x.model, list);
    }
    for (const [m, list] of perModel) {
      const avg = list.reduce((s, v) => s + v, 0) / list.length;
      const arr = byModel.get(m) ?? [];
      arr.push(avg);
      byModel.set(m, arr);
    }
  }
  return Array.from(byModel.entries()).map(([m, arr]) => {
    const latest = arr[arr.length - 1] ?? null;
    const previous = arr.length > 1 ? arr[arr.length - 2] : null;
    return {
      modelId: m,
      displayName: resolveName(m),
      latest,
      previous,
      delta: latest !== null && previous !== null ? latest - previous : null,
      episodes: arr.length,
    };
  });
}

export interface InsightRow {
  modelId: string;
  displayName: string;
  accuracy: number;
  cost: number;
}

/** Highest-accuracy row (cost breaks ties). */
export function pickBest(rows: Array<{ modelId: string; displayName: string; accuracy: number | null; cost: number }>): InsightRow | null {
  const scored = rows
    .filter((r) => r.accuracy !== null)
    .map((r) => ({ ...r, accuracy: r.accuracy as number }));
  if (scored.length === 0) return null;
  return [...scored].sort((a, b) => b.accuracy - a.accuracy || a.cost - b.cost)[0];
}

/** Best accuracy-per-dollar among paid rows. */
export function pickBestValue(rows: Array<{ modelId: string; displayName: string; accuracy: number | null; cost: number }>): InsightRow | null {
  const paid = rows
    .filter((r) => r.accuracy !== null && r.cost > 0)
    .map((r) => ({ ...r, accuracy: r.accuracy as number }));
  if (paid.length === 0) return null;
  return [...paid].sort((a, b) => b.accuracy / b.cost - a.accuracy / a.cost)[0];
}