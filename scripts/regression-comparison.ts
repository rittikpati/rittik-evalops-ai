/**
 * Regression tests for Model Comparison aggregation.
 *
 * These exercise the ACTUAL canonical aggregation module
 * (src/lib/ai/runAggregation.ts â€” aggregateComparison / aggregatePerModel) that
 * the Comparison page now consumes as its single source of truth for the table,
 * radar and scatter views. Guarantees verified here:
 *   - successRate is PER-MODEL (out of that model's own executions), never a
 *     run-wide denominator.
 *   - Failed executions and empty responses never contribute to metric averages
 *     and are never counted as 0.
 *   - Missing metrics are reported as null (N/A), never a misleading 0.
 *   - totalCost is summed from the real persisted estimatedCost per execution
 *     (not read from scores.cost, which is always absent).
 *   - totalTokens is summed from persisted totalTokens.
 *   - avgLatency is averaged only over successful executions.
 *   - Rows are sorted by accuracy desc (nulls last) so the best model leads.
 *
 * Run: npx tsx scripts/regression-comparison.ts
 */
import { aggregateComparison, aggregatePerModel } from "../backend/lib/ai/runAggregation";

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
  model: string;
  status: "success" | "error";
  latency?: number;
  estimatedCost?: number | null;
  totalTokens?: number;
  scores?: Record<string, number>;
}
function result(r: R) {
  return r;
}

// ---------------------------------------------------------------------------
// Test data: two models. gpt-4o: 4 successful + 2 failed. claude: 2 successful.
// The failed executions carry scores too, but must be excluded from averages.
// ---------------------------------------------------------------------------
const results = [
  // gpt-4o â€” successful scored executions
  result({ model: "openai/gpt-4o", status: "success", latency: 1000, estimatedCost: 0.01, totalTokens: 100, scores: { accuracy: 0.9, faithfulness: 0.85, relevance: 0.8, hallucination: 0.95, completeness: 0.9, toxicity: 1, bias: 0.9, safety: 1 } }),
  result({ model: "openai/gpt-4o", status: "success", latency: 1100, estimatedCost: 0.01, totalTokens: 120, scores: { accuracy: 0.7, faithfulness: 0.8, relevance: 0.7, hallucination: 0.9, completeness: 0.8, toxicity: 1, bias: 1, safety: 1 } }),
  result({ model: "openai/gpt-4o", status: "success", latency: 900, estimatedCost: 0.01, totalTokens: 90, scores: { accuracy: 0.8, faithfulness: 0.8, relevance: 0.9, hallucination: 0.9, completeness: 0.85, toxicity: 1, bias: 0.95, safety: 1 } }),
  result({ model: "openai/gpt-4o", status: "success", latency: 800, estimatedCost: 0.01, totalTokens: 80, scores: { accuracy: 0.6, faithfulness: 0.7, relevance: 0.6, hallucination: 0.8, completeness: 0.7, toxicity: 1, bias: 0.9, safety: 1 } }),
  // gpt-4o â€” FAILED executions with scores present but must be excluded
  result({ model: "openai/gpt-4o", status: "error", latency: 0, estimatedCost: 0, totalTokens: 0, scores: { accuracy: 0.1, relevance: 0.1, completeness: 0.1, toxicity: 0.1, bias: 0.1, safety: 0.1, faithfulness: 0.1, hallucination: 0.1 } }),
  result({ model: "openai/gpt-4o", status: "error", latency: 0, estimatedCost: 0, totalTokens: 0, scores: { accuracy: 0.2, relevance: 0.2, completeness: 0.2, toxicity: 0.2, bias: 0.2, safety: 0.2, faithfulness: 0.2, hallucination: 0.2 } }),
  // claude â€” 2 successful
  result({ model: "anthropic/claude-3.5-sonnet", status: "success", latency: 2000, estimatedCost: 0.02, totalTokens: 200, scores: { accuracy: 0.85, faithfulness: 0.9, relevance: 0.85, hallucination: 0.9, completeness: 0.9, toxicity: 1, bias: 0.85, safety: 1 } }),
  result({ model: "anthropic/claude-3.5-sonnet", status: "success", latency: 2100, estimatedCost: 0.02, totalTokens: 210, scores: { accuracy: 0.75, faithfulness: 0.85, relevance: 0.8, hallucination: 0.85, completeness: 0.85, toxicity: 1, bias: 0.9, safety: 1 } }),
];

const rows = aggregateComparison(results);
const gpt4o = rows.find((r) => r.modelId === "openai/gpt-4o")!;
const claude = rows.find((r) => r.modelId === "anthropic/claude-3.5-sonnet")!;

// --- 1. Per-model successRate (own denominator, failed excluded) ------------
check("gpt-4o total 6", gpt4o.total, 6);
check("gpt-4o successful 4", gpt4o.successful, 4);
checkNear("gpt-4o successRate 4/6", gpt4o.successRate, 4 / 6);
checkNear("claude successRate 2/2", claude.successRate, 1);

// --- 2. Failed executions excluded from metric averages ---------------------
// gpt-4o accuracy over 4 successful: (0.9+0.7+0.8+0.6)/4 = 0.75 (failed 0.1/0.2 excluded)
checkNear("gpt-4o accuracy excludes failed", gpt4o.accuracy, 0.75);
// relevance (0.8+0.7+0.9+0.6)/4 = 0.75
checkNear("gpt-4o relevance excludes failed", gpt4o.relevance, 0.75);
// completeness (0.9+0.8+0.85+0.7)/4 = 0.8125
checkNear("gpt-4o completeness excludes failed", gpt4o.completeness, 0.8125);

// --- 3. totalCost from estimatedCost (not scores.cost) ----------------------
checkNear("gpt-4o totalCost sums estimatedCost", gpt4o.totalCost, 0.04); // 4 * 0.01
checkNear("claude totalCost sums estimatedCost", claude.totalCost, 0.04); // 2 * 0.02

// --- 4. totalTokens summed --------------------------------------------------
check("gpt-4o totalTokens", gpt4o.totalTokens, 390); // 100+120+90+80
check("claude totalTokens", claude.totalTokens, 410); // 200+210

// --- 5. avgLatency only over successful executions --------------------------
checkNear("gpt-4o avgLatency (1000+1100+900+800)/4", gpt4o.avgLatency, 950);
checkNear("claude avgLatency", claude.avgLatency, 2050);

// --- 6. Missing metrics -> null, never 0 ------------------------------------
{
  const noMissing = aggregateComparison([result({ model: "m", status: "success", scores: { accuracy: 0.5 } })])[0];
  // No faithfulness/relevance/etc. scores -> null, NOT 0
  check("missing faithfulness -> null (not 0)", noMissing.faithfulness, null);
  check("missing relevance -> null (not 0)", noMissing.relevance, null);
  check("missing bias -> null (not 0)", noMissing.bias, null);
  check("missing safety -> null (not 0)", noMissing.safety, null);
  check("missing latency -> null (not 0)", noMissing.avgLatency, null);
  // accuracy IS provided
  checkNear("provided accuracy kept", noMissing.accuracy, 0.5);
}

// --- 7. All-failed model -> all null metrics, null latency -------------------
{
  const allFailed = aggregateComparison([result({ model: "m", status: "error", scores: { accuracy: 1 } })])[0];
  check("all-failed accuracy -> null", allFailed.accuracy, null);
  check("all-failed avgLatency -> null", allFailed.avgLatency, null);
  check("all-failed successRate 0", allFailed.successRate, 0);
  check("all-failed totalCost 0 (no cost data)", allFailed.totalCost, 0);
}

// --- 8. Best model ordering (accuracy desc, nulls last) ---------------------
checkNear("gpt-4o accuracy 0.75", gpt4o.accuracy, 0.75);
checkNear("claude accuracy 0.80", claude.accuracy, 0.8); // (0.85+0.75)/2
// claude (0.80) outranks gpt-4o (0.75) on accuracy, so it leads the sort
check("rows[0] is highest-accuracy model (claude)", rows[0].modelId, "anthropic/claude-3.5-sonnet");
check("rows[1] is gpt-4o", rows[1].modelId, "openai/gpt-4o");
// ordering is strictly desc by accuracy
check("claude accuracy >= gpt-4o accuracy", claude.accuracy! >= gpt4o.accuracy!, true);

// --- 8b. Null-accuracy models sort last (never misleading 0) -----------------
{
  const sorted = aggregateComparison([
    result({ model: "nullAcc", status: "success", latency: 500, estimatedCost: 0.1, scores: { faithfulness: 0.5 } }),
    result({ model: "low", status: "success", latency: 500, estimatedCost: 0.1, scores: { accuracy: 0.2 } }),
    result({ model: "high", status: "success", latency: 500, estimatedCost: 0.1, scores: { accuracy: 0.9 } }),
  ]);
  check("null-accuracy model sorts last", sorted[2].modelId, "nullAcc");
  check("null-accuracy accuracy is null (not 0)", sorted[2].accuracy, null);
  check("low before high? no (desc)", sorted[0].modelId, "high");
  check("middle is low", sorted[1].modelId, "low");
}

// --- 9. aggregatePerModel totalCost now uses estimatedCost (not scores.cost) ---
{
  const per = aggregatePerModel([
    result({ model: "m", status: "success", estimatedCost: 1.5, scores: { accuracy: 1 } }),
    result({ model: "m", status: "error", estimatedCost: 0.5, scores: { cost: 99 } }), // scores.cost must be ignored
  ])[0];
  // scores.cost (99) must be ignored; only estimatedCost summed
  checkNear("aggregatePerModel totalCost from estimatedCost", per.totalCost, 2.0);
}

console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
