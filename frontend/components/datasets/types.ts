import type { ParsedTestCaseWithMeta, TabularMapping } from "@/lib/datasets/import";

/** Exact shape returned by POST /api/datasets/upload and POST /api/datasets/paste. */
export interface DatasetPreviewDto {
  status: "success";
  detection: {
    kind: string;
    label: string;
    extension: string | null;
    extensionMessage: string | null;
    needsReview: boolean;
    message: string | null;
    sheets: string[];
  };
  file: { name: string; sizeBytes: number };
  summary: { total: number; valid: number; needsReview: number; skipped: number };
  cases: ParsedTestCaseWithMeta[];
  columns: string[];
  rawRecords: Record<string, string>[];
  mapping: TabularMapping | null;
  warnings: string[];
}

export type ApiError = { status: "error"; error: string; code?: string };

/** Editable representation of one test case in the review table. */
export interface EditableCase {
  key: string;
  input: string;
  expectedOutput: string;
  context: string;
  issue?: string | null;
  confidence?: number;
}

export function toEditable(c: ParsedTestCaseWithMeta, index: number): EditableCase {
  return {
    key: `c-${index}-${c.input.slice(0, 24).replace(/\s+/g, "-")}`,
    input: c.input,
    expectedOutput: c.expectedOutput ?? "",
    context: c.context ?? "",
    issue: c.issue ?? null,
    confidence: c.confidence,
  };
}

export function caseCount(cases: EditableCase[]): { valid: number; needsReview: number } {
  let needsReview = 0;
  for (const c of cases) {
    if (!c.input.trim() || c.issue || (c.confidence ?? 1) < 0.6) needsReview++;
  }
  return { valid: cases.length - needsReview, needsReview };
}