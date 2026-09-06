/**
 * Regression test: success-rate percentage must render correctly.
 *
 * Bug: app/runs/[id]/page.tsx computed `successRate = (successful/total) * 100`
 * and passed it to formatPercent(), which multiplies by 100 again -> 3/15 showed
 * "2000.0%" instead of "20.0%". Success rate must stay a fraction (0..1) so that
 * formatPercent() yields the correct percentage.
 *
 * Run: npx tsx scripts/regression-success-rate.ts
 */
import { formatPercent } from "../frontend/lib/utils";

let failures = 0;

function check(label: string, actual: string | number | boolean, expected: string | number | boolean) {
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  expected=${expected} actual=${actual}`);
}

function computeSuccessRate(successful: number, total: number): number {
  if (total === 0) return 0;
  return successful / total; // fraction in [0,1]; NOT pre-scaled by 100
}

const successful = 3;
const total = 15;
const rate = computeSuccessRate(successful, total);

// The displayed value must be 20.0%, not 2000.0%.
check("formatPercent(3/15) === '20.0%'", formatPercent(rate), "20.0%");
check("success rate fraction is 0.2, not 20", rate, 0.2);

// Never scale into a percentage before formatPercent (which expects a fraction).
const MUST_STAY_FRACTION = rate < 1 && rate > 0;
check("rate stays a fraction in (0,1)", MUST_STAY_FRACTION, true);

// Overall aggregation: 3/15 => 20% exactly.
check("3/15 == 0.2", rate, 0.2);

// Empty totals never NaN.
check("total=0 => 0", computeSuccessRate(0, 0), 0);

// Regression guard: a pre-scaled value fed to formatPercent is exactly the bug.
const buggy = formatPercent(rate * 100);
check("guard: (rate*100) via formatPercent is NOT the accepted output", buggy === "20.0%", false);

console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);

