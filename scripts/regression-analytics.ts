/**
 * Regression tests for the Analytics aggregation (src/lib/ai/runAggregation.ts
 * â€” aggregateRun), the single source of truth feeding the Analytics page's
 * trend points and metric cards. Guarantees verified here:
 *   - accuracy / judge metrics are null when a run has no successful scored
 *     execution (never a fabricated 0).
 *   - avgLatency is averaged only over successful executions, null when none.
 *   - successRate is per-run (successful/total over that run's executions).
 *   - totalCost / totalTokens are summed over ALL executions.
 *   - total / successful reflect the persisted execution statuses.
 *
 * Run: npx tsx scripts/regression-analytics.ts
 */
import { aggregateRun, aggregateRunStatus } from "../backend/lib/ai/runAggregation";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
}
function checkNear(label: string, actual: number | null, expected: number, eps = 1e-9) {
  const pass = actual !== null && Math.abs(actual - expected) < eps;
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  expected=${expected} actual=${actual}`);
}

interface R {
  status: "success" | "error";
  latency?: number;
  estimatedCost?: number | null;
  totalTokens?: number;
  scores?: Record<string, number>;
}
const result = (r: R) => r;

// --- 1. Mixed run: 3 successes + 2 failures --------------------------------
{
  const run = [
    result({ status: "success", latency: 1000, estimatedCost: 0.01, totalTokens: 100, scores: { accuracy: 0.9, faithfulness: 0.8, relevance: 0.7, hallucination: 0.9, completeness: 0.85, toxicity: 1, bias: 0.9, safety: 1 } }),
    result({ status: "success", latency: 2000, estimatedCost: 0.02, totalTokens: 200, scores: { accuracy: 0.7, faithfulness: 0.8, relevance: 0.8, hallucination: 0.85, completeness: 0.8, toxicity: 1, bias: 1, safety: 1 } }),
    result({ status: "success", latency: 3000, estimatedCost: 0.03, totalTokens: 300, scores: { accuracy: 0.5, faithfulness: 0.6, relevance: 0.5, hallucination: 0.8, completeness: 0.7, toxicity: 1, bias: 0.85, safety: 1 } }),
    // failures carry scores but must be excluded from averages
    result({ status: "error", latency: 0, estimatedCost: 0, totalTokens: 0, scores: { accuracy: 0.1, faithfulness: 0.1, relevance: 0.1, hallucination: 0.1 } }),
    result({ status: "error", latency: 0, estimatedCost: 0, totalTokens: 0, scores: { accuracy: 0.2, faithfulness: 0.2, relevance: 0.2, hallucination: 0.2 } }),
  ];
  const p = aggregateRun(run);
  check("total 5", p.total, 5);
  check("successful 3", p.successful, 3);
  check("successRate 3/5", p.successRate, 0.6);
  checkNear("accuracy (0.9+0.7+0.5)/3 = 0.7", p.accuracy, 0.7);
  checkNear("faithfulness (0.8+0.8+0.6)/3", p.faithfulness, 0.7333333333333333);
  checkNear("avgLatency (1000+2000+3000)/3 = 2000ms", p.avgLatency, 2000);
  checkNear("totalCost 0.06 summed over all", p.totalCost, 0.06);
  check("totalTokens 600 summed over all", p.totalTokens, 600);
}

// --- 2. All-failed run -> null metrics, not 0 --------------------------------
{
  const p = aggregateRun([
    result({ status: "error", latency: 0, estimatedCost: 0, totalTokens: 0, scores: { accuracy: 0.5 } }),
    result({ status: "error", latency: 0, estimatedCost: 0, totalTokens: 0, scores: { accuracy: 0.9 } }),
  ]);
  check("all-failed accuracy -> null", p.accuracy, null);
  check("all-failed faithfulness -> null", p.faithfulness, null);
  check("all-failed avgLatency -> null", p.avgLatency, null);
  check("all-failed successRate 0", p.successRate, 0);
  check("all-failed totalCost 0", p.totalCost, 0);
  check("all-failed totalTokens 0", p.totalTokens, 0);
  check("all-failed total 2", p.total, 2);
  check("all-failed successful 0", p.successful, 0);
}

// --- 3. Missing metric -> null, present metric kept -------------------------
{
  const p = aggregateRun([
    result({ status: "success", latency: 500, estimatedCost: 0.01, totalTokens: 50, scores: { accuracy: 0.8 } }),
  ]);
  check("missing faithfulness -> null (not 0)", p.faithfulness, null);
  check("missing bias -> null (not 0)", p.bias, null);
  checkNear("accuracy present 0.8", p.accuracy, 0.8);
  checkNear("avgLatency 500ms", p.avgLatency, 500);
}

// --- 4. aggregateRunStatus consistency (used for success rate trend) --------
{
  const s = aggregateRunStatus([
    result({ status: "error" as const }),
    result({ status: "error" as const }),
  ]);
  check("2 failed -> successRate 0", s.successRate, 0);
  check("2 failed -> status error", s.status, "error");
}

console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
