import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/api";
import { datasetRepository } from "@/lib/datasets/repository";
import type { Dataset } from "@/types";

const MAX_CASES_PER_IMPORT = 20000;
const MAX_INPUT = 2000;
const MAX_FIELD = 4000;

function fail(error: string, code: string, status = 400) {
  return NextResponse.json({ status: "error", error, code }, { status });
}

/**
 * POST /api/datasets/import — COMMIT step for the "Add Evaluation Data" flow.
 *
 * Creates a new dataset (or appends to an existing one when datasetId is
 * given) from canonical test cases the user reviewed in the preview. Server
 * validation is authoritative — the client's preview is only UX.
 */
export async function POST(req: NextRequest) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("We couldn't read your submission. Please try again.", "MALFORMED");
  }
  if (body === null || typeof body !== "object") return fail("Unexpected submission shape.", "MALFORMED");

  const b = body as Record<string, unknown>;

  // ---- cases
  const rawCases = b.cases;
  if (!Array.isArray(rawCases) || rawCases.length === 0) {
    return fail("We couldn't find any test cases to import. Add at least one, then try again.", "EMPTY_DATASET");
  }
  if (rawCases.length > MAX_CASES_PER_IMPORT) {
    return fail(
      `That's ${rawCases.length} test cases — import at most ${MAX_CASES_PER_IMPORT} at a time, or split the data into smaller files.`,
      "TOO_MANY_CASES"
    );
  }

  const cases: { input: string; expectedOutput?: string; context?: string }[] = [];
  for (let i = 0; i < rawCases.length; i++) {
    const raw = rawCases[i];
    if (raw === null || typeof raw !== "object") {
      return fail(`Test case ${i + 1} couldn't be read. Remove it and try again.`, "INVALID_CASE");
    }
    const rc = raw as Record<string, unknown>;
    const input = coerceString(rc.input).trim();
    const hasAnyData = [rc.input, rc.expectedOutput, rc.context].some((x) => x !== undefined && x !== null && String(x).trim() !== "");
    if (!input) {
      if (hasAnyData) return fail(`Test case ${i + 1} is missing a question or input.`, "MISSING_INPUT");
      continue; // fully empty row — skip
    }
    if (input.length > MAX_INPUT) {
      return fail(`Test case ${i + 1} is too long (max ${MAX_INPUT} characters).`, "INPUT_TOO_LONG");
    }
    const expectedOutput = optField(rc.expectedOutput);
    const context = optField(rc.context);
    if (expectedOutput === false) return fail(`Test case ${i + 1}'s expected answer is too long (max ${MAX_FIELD} characters).`, "FIELD_TOO_LONG");
    if (context === false) return fail(`Test case ${i + 1}'s context is too long (max ${MAX_FIELD} characters).`, "FIELD_TOO_LONG");
    cases.push({ input, expectedOutput: expectedOutput || undefined, context: context || undefined });
  }

  if (cases.length === 0) {
    return fail("We couldn't find any usable test cases to import.", "EMPTY_DATASET");
  }

  // ---- dataset targeting
  const datasetId = typeof b.datasetId === "string" && b.datasetId ? b.datasetId : undefined;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!datasetId && !name) return fail("Give the dataset a name.", "NAME_REQUIRED");
  if (!datasetId && name.length > 80) return fail("The dataset name is too long (max 80 characters).", "NAME_TOO_LONG");
  const description =
    typeof b.description === "string" && b.description.trim() ? b.description.trim().slice(0, 2000) : undefined;
  const version = typeof b.version === "string" && b.version.trim() ? b.version.trim().slice(0, 20) : undefined;
  const source =
    b.source && typeof b.source === "object" && typeof (b.source as Record<string, unknown>).format === "string"
      ? ((b.source as Record<string, unknown>).format as string).toLowerCase()
      : undefined;

  try {
    let ds: Dataset;
    if (datasetId) {
      const existing = await datasetRepository.getDataset(datasetId, auth.user.id);
      if (!existing) return fail("This dataset doesn't exist or you don't have access.", "DATASET_NOT_FOUND", 404);
      ds = existing;
    } else {
      ds = await datasetRepository.createDataset({
        name,
        ownerId: auth.user.id,
        description,
        format: (source || "txt") as Dataset["format"],
        version: version || "v1.0",
        tags: source && source !== "txt" ? [`source:${source}`] : [],
      });
    }

    let imported = 0;
    for (const tc of cases) {
      const created = await datasetRepository.createTestCase(ds.id, auth.user.id, {
        input: tc.input,
        expectedOutput: tc.expectedOutput || "",
        context: tc.context || undefined,
      });
      if (created) imported++;
    }

    const fresh = await datasetRepository.getDataset(ds.id, auth.user.id);
    return NextResponse.json(
      { status: "success", dataset: fresh ?? ds, imported, total: cases.length },
      { status: datasetId ? 200 : 201 }
    );
  } catch (e) {
    console.error("Dataset import failed", e);
    return fail("Something went wrong while saving the dataset. Please try again.", "UNEXPECTED", 500);
  }
}

function coerceString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return "";
}

/** Returns trimmed string, "" when empty/absent, or false when too long. */
function optField(value: unknown): string | false {
  if (value === undefined || value === null || value === "") return "";
  const s = coerceString(value).trim();
  if (s.length > MAX_FIELD) return false;
  return s;
}