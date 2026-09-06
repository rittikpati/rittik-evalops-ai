/**
 * Regression tests for run aggregation / status correctness.
 *
 * These exercise the ACTUAL canonical aggregation module used by the run
 * route (src/lib/ai/runAggregation.ts), so they verify the real source of
 * truth â€” not a reimplementation. Success is derived solely from
 * per-execution status === "success". Provider errors (EMPTY_RESPONSE,
 * INSUFFICIENT_CREDITS, RATE_LIMIT, ...) never count as success. Accuracy is
 * averaged only over successful results with a real finite numeric score.
 * Success rate is kept as a 0..1 fraction; only formatPercent scales it.
 *
 * Run: npx tsx scripts/regression-aggregation.ts
 */
import { aggregateRunStatus, aggregatePerModel, averageAccuracy } from "../backend/lib/ai/runAggregation";
import { formatPercent } from "../frontend/lib/utils";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
}
function checkNear(label: string, actual: number, expected: number, eps = 1e-9) {
  const pass = Math.abs(actual - expected) < eps;
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  expected=${expected} actual=${actual}`);
}

function result(status: "success" | "error", model: string, accuracy?: number, code?: string) {
  const r: {
    model: string;
    status: "success" | "error";
    code?: string;
    scores?: { accuracy?: number | null };
  } = { model, status };
  if (accuracy !== undefined) r.scores = { accuracy };
  if (code) r.code = code;
  return r;
}

// --- 1. 3 successful + 12 failed -> 3/15 -> 20.0% -> Partial ---------------
{
  const results = [
    ...Array.from({ length: 3 }, () => result("success", "dots", 0.9)),
    ...Array.from({ length: 2 }, () => result("error", "dots", undefined, "EMPTY_RESPONSE")),
    ...Array.from({ length: 5 }, () => result("error", "gpt4o", undefined, "INSUFFICIENT_CREDITS")),
    ...Array.from({ length: 5 }, () => result("error", "claude", undefined, "INSUFFICIENT_CREDITS")),
  ];
  const s = aggregateRunStatus(results);
  check("3/15 total", s.total, 15);
  check("3/15 successful", s.successful, 3);
  check("3/15 failed", s.failed, 12);
  checkNear("3/15 successRate fraction (0.2)", s.successRate, 0.2);
  check("3/15 successRate is 0.2 not 20", formatPercent(s.successRate), "20.0%");
  check("3/15 status partial", s.status, "partial");
}

// --- 2. 0 successful + 15 failed -> 0.0% -> Failed -------------------------
{
  const results = Array.from({ length: 15 }, () => result("error", "gpt4o", undefined, "INSUFFICIENT_CREDITS"));
  const s = aggregateRunStatus(results);
  check("0/15 successful", s.successful, 0);
  check("0/15 failed", s.failed, 15);
  check("0/15 successRate fraction (0)", s.successRate, 0);
  check("0/15 successRate renders 0.0%", formatPercent(s.successRate), "0.0%");
  check("0/15 status failed", s.status, "error");
}

// --- 3. 15 successful + 0 failed -> 100.0% -> Completed --------------------
{
  const results = Array.from({ length: 15 }, () => result("success", "dots", 0.8));
  const s = aggregateRunStatus(results);
  check("15/15 successful", s.successful, 15);
  check("15/15 failed", s.failed, 0);
  check("15/15 successRate fraction (1)", s.successRate, 1);
  check("15/15 successRate renders 100.0%", formatPercent(s.successRate), "100.0%");
  check("15/15 status success", s.status, "success");
}

// --- 4. Per-model 3/5 -> 60.0% ---------------------------------------------
{
  const results = [
    ...Array.from({ length: 3 }, () => result("success", "dots", 0.9)),
    ...Array.from({ length: 2 }, () => result("error", "dots", undefined, "EMPTY_RESPONSE")),
  ];
  const per = aggregatePerModel(results);
  check("per-model count", per.length, 1);
  check("per-model total 5", per[0].total, 5);
  check("per-model successful 3", per[0].successful, 3);
  checkNear("per-model successRate 0.6", per[0].successRate, 0.6);
  check("per-model successRate renders 60.0%", formatPercent(per[0].successRate), "60.0%");
  checkNear("per-model avgAccuracy (3 valid)", per[0].avgAccuracy as number, 0.9);
}

// --- 5. Failed executions never counted as success -------------------------
{
  const results = [
    result("success", "m", 0.5),
    result("error", "m", undefined, "RATE_LIMIT"),
    result("error", "m", undefined, "EMPTY_RESPONSE"),
    result("error", "m", undefined, "INSUFFICIENT_CREDITS"),
  ];
  const s = aggregateRunStatus(results);
  check("failed never counted (successful=1)", s.successful, 1);
  check("failed never counted (failed=3)", s.failed, 3);
  check("failed never counted (status partial)", s.status, "partial");
}

// --- 6. EMPTY_RESPONSE never counted as success ----------------------------
{
  const onlyEmpty = [result("error", "m", undefined, "EMPTY_RESPONSE"), result("error", "m", undefined, "EMPTY_RESPONSE")];
  const s = aggregateRunStatus(onlyEmpty);
  check("EMPTY_RESPONSE successful=0", s.successful, 0);
  check("EMPTY_RESPONSE status failed", s.status, "error");
  check("EMPTY_RESPONSE avgAccuracy null", averageAccuracy(onlyEmpty), null);
}

// --- 7. INSUFFICIENT_CREDITS never counted as success ----------------------
{
  const onlyCredits = [result("error", "m", undefined, "INSUFFICIENT_CREDITS"), result("error", "m", undefined, "INSUFFICIENT_CREDITS")];
  const s = aggregateRunStatus(onlyCredits);
  check("INSUFFICIENT_CREDITS successful=0", s.successful, 0);
  check("INSUFFICIENT_CREDITS status failed", s.status, "error");
  check("INSUFFICIENT_CREDITS avgAccuracy null", averageAccuracy(onlyCredits), null);
}

// --- 8. Accuracy excludes failed and empty results -------------------------
{
  const results = [
    result("success", "m", 0.9),
    result("success", "m", 0.7),
    result("error", "m", undefined, "EMPTY_RESPONSE"),
    result("error", "m", undefined, "INSUFFICIENT_CREDITS"),
    result("success", "m"), // successful but no numeric accuracy
  ];
  const acc = averageAccuracy(results);
  checkNear("accuracy averages only valid scored successes", acc as number, 0.8); // (0.9+0.7)/2
}

// --- 9. Success rate fraction guard (never pre-scaled) ---------------------
{
  const s = aggregateRunStatus(Array.from({ length: 5 }, (_, i) => result(i < 4 ? "success" : "error", "m", 1)));
  check("rate stays 0.8 in fraction form", s.successRate, 0.8);
  check("formatPercent(0.8) => 80.0%", formatPercent(s.successRate), "80.0%");
}

console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
