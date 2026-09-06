export type RunStatusKind = "success" | "partial" | "error";

export interface RunStatusSummary {
  total: number;
  successful: number;
  failed: number;
  /** 0..1 fraction. Multiply by 100 / format at the presentation layer only. */
  successRate: number;
  status: RunStatusKind;
}

export interface RunResultLike {
  status: string;
  model?: string;
  /** latency in milliseconds (successful executions only) */
  latency?: number;
  /** persisted per-execution cost in dollars */
  estimatedCost?: number | null;
  /** persisted total token count for the execution */
  totalTokens?: number;
  scores?: { accuracy?: number | null } | Record<string, number | undefined | null>;
}

export function aggregateRunStatus(results: RunResultLike[]): RunStatusSummary {
  const total = results.length;
  const successful = results.filter((r) => r.status === "success").length;
  const failed = total - successful;
  const status: RunStatusKind = failed === 0 ? "success" : successful === 0 ? "error" : "partial";
  return {
    total,
    successful,
    failed,
    successRate: total > 0 ? successful / total : 0,
    status,
  };
}

export interface PerModelRunAggregation {
  modelId: string;
  /** total executions for this model */
  total: number;
  /** number of successful executions for this model */
  successful: number;
  /** 0..1 fraction */
  successRate: number;
  /** accuracy averaged only over successful results with a real numeric score, or null */
  avgAccuracy: number | null;
  /** per-metric averages (0..1) over successful results with a real numeric score, or null */
  avgMetrics: {
    faithfulness?: number | null;
    relevance?: number | null;
    hallucination?: number | null;
    completeness?: number | null;
    toxicity?: number | null;
    bias?: number | null;
    safety?: number | null;
  };
  /** average latency (ms) over successful executions, or null if none */
  avgLatency: number | null;
  /** total cost summed over ALL executions (successful + failed) */
  totalCost: number;
  /** total tokens summed over ALL executions (successful + failed) */
  totalTokens: number;
}

/** Average numeric accuracy over results that actually have a finite score. */
export function averageAccuracy(results: RunResultLike[]): number | null {
  const scored = results.filter(
    (r) => r.status === "success" && typeof r.scores?.accuracy === "number" && Number.isFinite(r.scores.accuracy)
  );
  if (scored.length === 0) return null;
  const sum = scored.reduce((s, r) => s + (r.scores as { accuracy: number }).accuracy, 0);
  return sum / scored.length;
}

/** Average a named numeric metric over successful results that carry a finite score. */
export function averageMetric(results: RunResultLike[], key: string): number | null {
  const scored = results.filter((r) => {
    const scores = r.scores as Record<string, unknown> | undefined;
    return r.status === "success" && typeof scores?.[key] === "number" && Number.isFinite(scores[key] as number);
  });
  if (scored.length === 0) return null;
  const sum = scored.reduce((s, r) => s + (((r.scores as Record<string, unknown>)[key] as number) ?? 0), 0);
  return sum / scored.length;
}

const AGGREGATED_METRICS = ["faithfulness", "relevance", "hallucination", "completeness", "toxicity", "bias", "safety"] as const;

/**
 * Group results by model and compute per-model aggregation. Only successful
 * executions contribute to successRate/accuracy; failures are excluded.
 */
export function aggregatePerModel(results: RunResultLike[]): PerModelRunAggregation[] {
  const byModel = new Map<string, RunResultLike[]>();
  for (const r of results) {
    const key = r.model ?? "unknown";
    const list = byModel.get(key) || [];
    list.push(r);
    byModel.set(key, list);
  }
  const out: PerModelRunAggregation[] = [];
  for (const [modelId, list] of byModel.entries()) {
    const successful = list.filter((r) => r.status === "success").length;
    const avgMetrics: PerModelRunAggregation["avgMetrics"] = {};
    for (const key of AGGREGATED_METRICS) {
      avgMetrics[key] = averageMetric(list, key);
    }
    const latencyVals = list.filter((r) => r.status === "success" && typeof r.latency === "number").map((r) => r.latency as number);
    out.push({
      modelId,
      total: list.length,
      successful,
      successRate: list.length > 0 ? successful / list.length : 0,
      avgAccuracy: averageAccuracy(list),
      avgMetrics,
      avgLatency: latencyVals.length ? latencyVals.reduce((s, v) => s + v, 0) / latencyVals.length : null,
      totalCost: list.reduce((s, r) => s + (r.estimatedCost ?? 0), 0),
      totalTokens: list.reduce((s, r) => s + (r.totalTokens ?? 0), 0),
    });
  }
  return out;
}

/**
 * Per-model comparison row used by the Comparison UI as the single source of
 * truth for the table, radar and scatter views. All judge metrics are 0..1 or
 * null; a null value means the model has no scored execution for that metric
 * and is rendered as N/A â€” never as a misleading 0. successRate is per-model
 * (out of that model's own executions). avgLatency is over successful
 * executions only. totalCost/totalTokens are summed over all executions.
 */
export interface ComparisonRow {
  modelId: string;
  total: number;
  successful: number;
  successRate: number;
  accuracy: number | null;
  faithfulness: number | null;
  relevance: number | null;
  hallucination: number | null;
  completeness: number | null;
  toxicity: number | null;
  bias: number | null;
  safety: number | null;
  avgLatency: number | null;
  totalCost: number;
  totalTokens: number;
}

export function aggregateComparison(results: RunResultLike[]): ComparisonRow[] {
  return aggregatePerModel(results)
    .map((m) => ({
      modelId: m.modelId,
      total: m.total,
      successful: m.successful,
      successRate: m.successRate,
      accuracy: m.avgAccuracy,
      faithfulness: m.avgMetrics.faithfulness ?? null,
      relevance: m.avgMetrics.relevance ?? null,
      hallucination: m.avgMetrics.hallucination ?? null,
      completeness: m.avgMetrics.completeness ?? null,
      toxicity: m.avgMetrics.toxicity ?? null,
      bias: m.avgMetrics.bias ?? null,
      safety: m.avgMetrics.safety ?? null,
      avgLatency: m.avgLatency,
      totalCost: m.totalCost,
      totalTokens: m.totalTokens,
    }))
    .sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1));
}

/**
 * Summary of a single run (or any standalone set of executions) used by the
 * Analytics surface. One run = one point on a trend line. All judge metrics
 * are 0..1 or null; a null value means the run produced no scored execution
 * for that metric and is rendered as a gap (never a fabricated 0). successRate
 * is 0..1. avgLatency is averaged only over successful executions.
 */
export interface RunPoint {
  accuracy: number | null;
  faithfulness: number | null;
  relevance: number | null;
  hallucination: number | null;
  completeness: number | null;
  toxicity: number | null;
  bias: number | null;
  safety: number | null;
  successRate: number;
  avgLatency: number | null;
  totalCost: number;
  totalTokens: number;
  total: number;
  successful: number;
}

export function aggregateRun(results: RunResultLike[]): RunPoint {
  const summary = aggregateRunStatus(results);
  const successful = results.filter((r) => r.status === "success");
  const latencyVals = successful.filter((r) => typeof r.latency === "number").map((r) => r.latency as number);
  return {
    accuracy: averageAccuracy(results),
    faithfulness: averageMetric(results, "faithfulness"),
    relevance: averageMetric(results, "relevance"),
    hallucination: averageMetric(results, "hallucination"),
    completeness: averageMetric(results, "completeness"),
    toxicity: averageMetric(results, "toxicity"),
    bias: averageMetric(results, "bias"),
    safety: averageMetric(results, "safety"),
    successRate: summary.successRate,
    avgLatency: latencyVals.length ? latencyVals.reduce((s, v) => s + v, 0) / latencyVals.length : null,
    totalCost: results.reduce((s, r) => s + (r.estimatedCost ?? 0), 0),
    totalTokens: results.reduce((s, r) => s + (r.totalTokens ?? 0), 0),
    total: summary.total,
    successful: summary.successful,
  };
}
