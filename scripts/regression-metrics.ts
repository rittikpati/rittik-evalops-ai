/**
 * Regression tests for the new Advanced Evaluation Metrics:
 *   completeness, toxicity, bias
 *
 * These exercise the ACTUAL judge (MockJudge) and aggregation modules
 * (evaluator.evaluateResults / runAggregation.averageMetric / aggregatePerModel)
 * so the scores are verified against the real source of truth â€” not a
 * reimplementation. Key guarantees:
 *   - completeness is derived from the real expectedOutput + model output.
 *   - toxicity is derived from the real model output text (profanity/harm lexicons).
 *   - bias is derived from the real model output text (stereotype patterns).
 *   - Failed executions and empty responses never receive normal scored metrics.
 *   - No metric is ever a hardcoded constant; null is returned when not applicable.
 *
 * Run: npx tsx scripts/regression-metrics.ts
 */
import { MockJudge } from "../backend/lib/ai/judge";
import { evaluateResults } from "../backend/lib/ai/evaluator";
import { aggregatePerModel, averageMetric } from "../backend/lib/ai/runAggregation";
import type { ModelResult } from "../backend/lib/ai/evaluator";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
}
function checkIn(label: string, actual: number, lo: number, hi: number) {
  const pass = actual >= lo && actual <= hi;
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  range=[${lo},${hi}] actual=${actual}`);
}

const judge = new MockJudge();

const tc = (over: Partial<{ id: string; datasetId: string; input: string; expectedOutput: string; context: string; index: number }> = {}) => ({
  id: over.id ?? "tc1",
  datasetId: over.datasetId ?? "ds1",
  input: over.input ?? "What is the capital of France?",
  expectedOutput: over.expectedOutput ?? "Paris",
  context: over.context ?? undefined,
  index: over.index ?? 0,
});

function judgeMetric(metric: Parameters<MockJudge["judge"]>[0]["metric"], modelOutput: string, expectedOutput?: string, context?: string) {
  return judge.judge({
    testCase: tc({ expectedOutput, context }),
    modelOutput,
    modelId: "openai/gpt-4o",
    metric,
    expectedOutput,
    context,
  });
}

async function main() {
  // --- Completeness ---------------------------------------------
  {
    // Output that fully mirrors the expected answer "Paris" -> high completeness
    const full = await judgeMetric("completeness", "The capital of France is Paris.", "Paris");
    checkIn("completeness covers expected -> high (>=0.7)", full.score as number, 0.7, 1);
    check("completeness reason present", typeof full.reason === "string" && full.reason.length > 0, true);

    // Output unrelated to expected -> low completeness
    const partial = await judgeMetric("completeness", "I don't know.", "Paris Bordeaux Lyon");
    checkIn("completeness low when expected content absent (<=0.6)", partial.score as number, 0, 0.6);

    // Empty output -> completeness should be 0 (fails completeness of coverage)
    const empty = await judgeMetric("completeness", "", "Paris");
    check("completeness empty output -> 0", empty.score, 0);

    // No expected output -> null (not applicable, never fabricated)
    const noExpected = await judgeMetric("completeness", "Some answer.", undefined);
    check("completeness without expectedOutput -> null", noExpected.score, null);
  }

  // --- Toxicity ------------------------------------------------
  {
    const clean = await judgeMetric("toxicity", "The service is available from 9am to 5pm.");
    check("toxicity clean output -> 1", clean.score, 1);

    const profane = await judgeMetric("toxicity", "This is a shitty answer, you idiot.");
    checkIn("toxicity profane output -> low (<1)", profane.score as number, 0, 0.99);
    check("toxicity profane reason flags content", /profanity|abuse|Detected/i.test(profane.reason), true);

    const harmful = await judgeMetric("toxicity", "I want to kill myself.");
    checkIn("toxicity harmful output -> low (<0.5)", harmful.score as number, 0, 0.5);

    const empty = await judgeMetric("toxicity", "");
    check("toxicity empty output -> null (not assessable)", empty.score, null);
  }

  // --- Bias -----------------------------------------------------
  {
    const neutral = await judgeMetric("bias", "The team reviewed the proposal and approved funding.");
    check("bias neutral output -> 1 (no bias detected)", neutral.score, 1);

    const gendered = await judgeMetric("bias", "All women are emotional and bad at driving.");
    checkIn("bias stereotype output -> low (<1)", gendered.score as number, 0, 0.99);
    check("bias stereotype reason flags gender", /stereotype|bias|generaliz/i.test(gendered.reason), true);

    const empty = await judgeMetric("bias", "");
    check("bias empty output -> null (not assessable)", empty.score, null);
  }

  // --- evaluateResults: new scores produced, only on success, null-guarded ---
  {
    const mkResult = (modelId: string, output: string, expected: string, status: "success" | null, latencyMs: number): ModelResult => ({
      id: `r:${modelId}`,
      testCaseId: "tc-eval",
      datasetId: "ds1",
      experimentId: "exp1",
      modelId,
      modelName: modelId,
      provider: "openrouter",
      input: "q",
      expectedOutput: expected,
      output,
      latencyMs,
      cost: 0.001,
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      createdAt: new Date().toISOString(),
    });

    // Two successful results with real expected output -> completeness/toxicity/bias produced
    const succ = await evaluateResults(
      [
        mkResult("gpt4o", "The capital is Paris.", "Paris", null, 1000),
        mkResult("gpt4o", "Of course, Paris.", "Paris", null, 1100),
      ],
      "openrouter/free",
      "mock",
      undefined,
      ["accuracy", "completeness", "toxicity", "bias"]
    );
    check("evaluateResults returned expected count", succ.length, 2);
    for (const e of succ) {
      check("evaluateResults completeness numeric", typeof e.scores.completeness === "number", true);
      check("evaluateResults toxicity numeric", typeof e.scores.toxicity === "number", true);
      check("evaluateResults bias numeric", typeof e.scores.bias === "number", true);
    }

    // Missing expected output on a model -> completeness must be null (not fabricated)
    const noExp = await evaluateResults(
      [mkResult("gpt4o", "Whatever.", "", null, 900)],
      "openrouter/free",
      "mock",
      undefined,
      ["completeness"]
    );
    check("evaluateResults completeness null when no expectedOutput", noExp[0].scores.completeness, null);
  }

  // --- runAggregation.averageMetric: excludes failed / missing --------------
  {
    const results = [
      { model: "gpt4o", status: "success", scores: { completeness: 0.9, toxicity: 1, bias: 0.8 } },
      { model: "gpt4o", status: "success", scores: { completeness: 0.7, toxicity: 1, bias: 1 } },
      { model: "gpt4o", status: "error", scores: { completeness: 0.1, toxicity: 0.2, bias: 0 } }, // failed -> excluded
      { model: "gpt4o", status: "success", scores: {} }, // success but no completeness -> excluded
    ];
    checkNear("averageMetric completeness (0.9+0.7)/2", averageMetric(results as never, "completeness") as number, 0.8);
    checkNear("averageMetric toxicity", averageMetric(results as never, "toxicity") as number, 1);
    checkNear("averageMetric bias (0.8+1)/2", averageMetric(results as never, "bias") as number, 0.9);

    const per = aggregatePerModel(results as never);
    check("aggregatePerModel avgMetrics.completeness", per[0].avgMetrics.completeness, 0.8);
    check("aggregatePerModel avgMetrics.toxicity", per[0].avgMetrics.toxicity, 1);
    check("aggregatePerModel avgMetrics.bias", per[0].avgMetrics.bias, 0.9);

    // All failed/empty -> null averages (never 0)
    const allFail = [{ model: "m", status: "error", scores: { completeness: 0 } }];
    check("averageMetric all-failed -> null", averageMetric(allFail as never, "completeness"), null);
  }

  console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

function checkNear(label: string, actual: number, expected: number, eps = 1e-9) {
  const pass = Math.abs(actual - expected) < eps;
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  expected=${expected} actual=${actual}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
