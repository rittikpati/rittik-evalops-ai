export const SUPPORTED_FORMATS = ["json", "jsonl", "csv", "parquet"] as const;
export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

/** Maximum accepted upload size (server-enforced). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

const INPUT_ALIASES = [
  "input",
  "question",
  "query",
  "prompt",
  "instruction",
  "text",
  "content",
  "input_text",
  "question_text",
  "case_input",
];

const EXPECTED_ALIASES = [
  "expectedOutput",
  "expected_output",
  "expected",
  "output",
  "answer",
  "reference",
  "ideal",
  "gold",
  "label",
  "expected_answer",
];

const CONTEXT_ALIASES = [
  "context",
  "contexts",
  "context_text",
  "background",
  "source_text",
  "passage",
  "source",
];

export interface ParsedTestCase {
  input: string;
  expectedOutput?: string;
  context?: string;
}

export class DatasetImportError extends Error {
  constructor(
    public code:
      | "UNSUPPORTED_TYPE"
      | "PARQUET_UNSUPPORTED"
      | "EMPTY_FILE"
      | "FILE_TOO_LARGE"
      | "INVALID_JSON"
      | "MISSING_FIELDS"
      | "EMPTY_DATASET",
    message: string
  ) {
    super(message);
    this.name = "DatasetImportError";
  }
}

/** Coerces a raw cell value into trimmed text (numbers/booleans become strings). */
function toText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const t = value.trim();
    return t ? t : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return undefined;
}

/** Finds the first alias present with a usable value (arrays are joined with newlines). */
function pickField(record: Record<string, unknown>, aliases: string[]): string | undefined {
  for (const alias of aliases) {
    if (!(alias in record)) continue;
    const value = record[alias];
    if (Array.isArray(value)) {
      const parts = value.map((v) => toText(v)).filter((v): v is string => Boolean(v));
      if (parts.length > 0) return parts.join("\n");
    } else {
      const t = toText(value);
      if (t) return t;
    }
  }
  return undefined;
}

/** Maps one raw record into a normalized test case, or null when it has no usable input. */
export function normalizeRecord(record: Record<string, unknown>): ParsedTestCase | null {
  if (record === null || typeof record !== "object") return null;
  const input = pickField(record, INPUT_ALIASES);
  if (!input) return null;
  return {
    input,
    expectedOutput: pickField(record, EXPECTED_ALIASES),
    context: pickField(record, CONTEXT_ALIASES),
  };
}

/**
 * Extracts test cases from a parsed JSON/JSONL document.
 * Supports an array of objects, or an object wrapping one of
 * { testCases, cases, data } arrays. Invalid entries are counted
 * (not silently dropped) so callers can report them.
 */
export function extractTestCases(parsed: unknown): { cases: ParsedTestCase[]; skipped: number } {
  let records: unknown[] = [];
  if (Array.isArray(parsed)) {
    records = parsed;
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.testCases)) records = obj.testCases;
    else if (Array.isArray(obj.cases)) records = obj.cases;
    else if (Array.isArray(obj.data)) records = obj.data;
  }

  const cases: ParsedTestCase[] = [];
  let skipped = 0;
  for (const item of records) {
    if (!item || typeof item !== "object") {
      skipped++;
      continue;
    }
    const tc = normalizeRecord(item as Record<string, unknown>);
    if (tc) cases.push(tc);
    else skipped++;
  }
  return { cases, skipped };
}

/** Minimal RFC-4180-ish CSV parser â€” supports quoted fields with embedded commas/newlines and escaped quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
    } else if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/** Parses CSV text into normalized test cases using the common header aliases. */
export function extractFromCsv(text: string): ParsedTestCase[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim());
  const findColumn = (aliases: string[]): number => {
    for (const alias of aliases) {
      const exact = header.indexOf(alias);
      if (exact !== -1) return exact;
      const lower = header.findIndex((h) => h.toLowerCase() === alias.toLowerCase());
      if (lower !== -1) return lower;
    }
    return -1;
  };

  const inputCol = findColumn(INPUT_ALIASES);
  if (inputCol === -1) {
    throw new DatasetImportError(
      "MISSING_FIELDS",
      `Could not find a question/input column in the CSV header. Expected one of: ${INPUT_ALIASES.join(", ")}.`
    );
  }
  const expectedCol = findColumn(EXPECTED_ALIASES);
  const contextCol = findColumn(CONTEXT_ALIASES);

  const cases: ParsedTestCase[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const input = (row[inputCol] ?? "").trim();
    if (!input) continue;
    cases.push({
      input,
      expectedOutput: expectedCol >= 0 ? (row[expectedCol] ?? "").trim() || undefined : undefined,
      context: contextCol >= 0 ? (row[contextCol] ?? "").trim() || undefined : undefined,
    });
  }
  return cases;
}

/** Detects the file format from its extension. */
export function detectFormat(filename: string): SupportedFormat | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return (SUPPORTED_FORMATS as readonly string[]).includes(ext) ? (ext as SupportedFormat) : null;
}

/** Extension guard for the client pre-check (mirrors detectFormat behavior + parquet flag). */
export function isSupportedExtension(filename: string): boolean {
  return detectFormat(filename) !== null;
}

/**
 * Parses the uploaded file content for the given filename.
 * Throws DatasetImportError with a human-friendly message + machine code
 * for every failure mode (unsupported type, parquet, empty, invalid JSON,
 * missing required fields). Never produces placeholder test cases.
 */
export function parseDatasetContent(
  filename: string,
  content: string
): { format: Exclude<SupportedFormat, "parquet">; cases: ParsedTestCase[]; skipped: number } {
  const format = detectFormat(filename);
  if (!format) {
    throw new DatasetImportError(
      "UNSUPPORTED_TYPE",
      "Unsupported file type. Please upload a .json, .jsonl, .csv or .parquet file."
    );
  }
  if (format === "parquet") {
    throw new DatasetImportError(
      "PARQUET_UNSUPPORTED",
      "Parquet files are not supported by the current server runtime (no parquet reader is available). Export the dataset as JSON, JSONL, or CSV instead."
    );
  }
  if (content.trim().length === 0) {
    throw new DatasetImportError("EMPTY_FILE", "The uploaded file is empty. Please upload a file containing test cases.");
  }

  if (format === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content.replace(/^\uFEFF/, ""));
    } catch {
      throw new DatasetImportError("INVALID_JSON", "Invalid JSON. Please upload a valid JSON file.");
    }
    const { cases, skipped } = extractTestCases(parsed);
    return { format, cases, skipped };
  }

  if (format === "jsonl") {
    const lines = content
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const cases: ParsedTestCase[] = [];
    let skipped = 0;
    lines.forEach((line, index) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        throw new DatasetImportError(
          "INVALID_JSON",
          `Invalid JSON on line ${index + 1}: "${line.slice(0, 60)}". Every line must be a valid JSON object.`
        );
      }
      if (parsed && typeof parsed === "object") {
        const tc = normalizeRecord(parsed as Record<string, unknown>);
        if (tc) cases.push(tc);
        else skipped++;
      } else {
        skipped++;
      }
    });
    return { format, cases, skipped };
  }

  // csv
  const cases = extractFromCsv(content);
  return { format, cases, skipped: 0 };
}

// ---------------------------------------------------------------------------
// Universal ingestion â€” text/structure extraction for TXT, Markdown, HTML,
// PDF/DOCX (after text extraction) and tabular remapping. All pure TS (no
// Node/Db imports) so this module stays safe for client components.
// ---------------------------------------------------------------------------

export interface ParsedTestCaseWithMeta extends ParsedTestCase {
  /** Human reason this row needs review ("" when confident). */
  issue?: string;
  /** 0..1 confidence that the row was mapped correctly. */
  confidence: number;
}

export interface TabularMapping {
  input: string | null;
  expectedOutput: string | null;
  context: string | null;
  headers: string[];
  lowConfidence: boolean;
}

export interface ExtractionResult {
  cases: ParsedTestCaseWithMeta[];
  /** Human-readable notes (e.g. "no expected-output column detected"). */
  warnings: string[];
  /** Present for tabular sources (CSV/XLSX) so the UI can show/override the mapping. */
  mapping?: TabularMapping;
  /** Raw string rows for tabular sources (capped) â€” used only for mapping overrides. */
  rawRecords?: Record<string, string>[];
  /** True when content was image-only / had no extractable text. */
  unreadable?: boolean;
  /** Multi-sheet workbooks expose their sheet names here (server only). */
  sheets?: string[];
}

export interface PasteDetection {
  kind: "json" | "jsonl" | "csv" | "markdown" | "html" | "text" | "unknown";
  label: string;
}

const QUESTION_LINE = /^\s*(?:\d+[.)]\s*|\?>\s*)?(?:question|q|prompt|input)\s*[:\-â€“â€”>]\s*(.*)$/i;
const ANSWER_LINE = /^\s*(?:answer|a|expected(?:\s+answer)?|expected_output|output|gold(?:\s+answer)?|ideal)\s*[:\-â€“â€”>]\s*(.*)$/i;

/** Matches a header cell name to a field using the alias lists. */
function classifyHeader(name: string): "input" | "expectedOutput" | "context" | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  if (INPUT_ALIASES.some((a) => a.toLowerCase() === n)) return "input";
  if (EXPECTED_ALIASES.some((a) => a.toLowerCase() === n)) return "expectedOutput";
  if (CONTEXT_ALIASES.some((a) => a.toLowerCase() === n)) return "context";
  // Fuzzy: contains a keyword.
  if (/question|input|query|prompt|instruction|user|case_input/.test(n)) return "input";
  if (/expected|answer|output|reference|ideal|gold|label|response/.test(n)) return "expectedOutput";
  if (/context|source|background|passage|reference_text/.test(n)) return "context";
  return null;
}

/** Builds a mapping from tabular headers. Unknown first column defaults to input at low confidence. */
export function detectTabularMapping(headers: string[]): TabularMapping {
  const mapping: TabularMapping = {
    input: null,
    expectedOutput: null,
    context: null,
    headers,
    lowConfidence: false,
  };
  for (const h of headers) {
    const field = classifyHeader(h);
    if (field && !mapping[field]) mapping[field] = h;
  }
  const used = new Set([mapping.input, mapping.expectedOutput, mapping.context].filter(Boolean));
  if (!mapping.input && headers.length > 0) {
    mapping.input = headers.find((h) => !used.has(h)) ?? headers[0];
    mapping.lowConfidence = true;
  }
  if (!mapping.expectedOutput) mapping.lowConfidence = true;
  return mapping;
}

/** Normalizes tabular rows given a mapping (uses mapping name when the default is bad). */
export function buildCasesFromRecords(
  records: Record<string, string>[],
  mapping: TabularMapping
): ExtractionResult {
  const cases: ParsedTestCaseWithMeta[] = [];
  const warnings: string[] = [];
  records.forEach((rec, i) => {
    const get = (col: string | null) => (col ? (rec[col] ?? "").trim() : "");
    const input = get(mapping.input);
    if (!input) {
      // Skip fully-empty rows; flag rows that have data but a missing input.
      if (Object.values(rec).some((v) => v.trim())) {
        cases.push({
          input: "",
          expectedOutput: get(mapping.expectedOutput) || undefined,
          context: get(mapping.context) || undefined,
          issue: `Row ${i + 1} is missing a question/input.`,
          confidence: 0,
        });
      }
      return;
    }
    const expectedOutput = get(mapping.expectedOutput);
    cases.push({
      input,
      expectedOutput: expectedOutput || undefined,
      context: get(mapping.context) || undefined,
      confidence: !mapping.lowConfidence ? 0.95 : 0.6,
      issue: mapping.lowConfidence && !expectedOutput ? "No expected answer column detected â€” verify this row." : undefined,
    });
  });
  if (!mapping.expectedOutput) warnings.push("No expected-output column was detected. Only the input/question will be imported.");
  if (mapping.lowConfidence) warnings.push("The column mapping is uncertain â€” review the rows before importing.");
  return { cases, warnings, mapping, rawRecords: records };
}

/**
 * Parses labeled Question/Answer text. Questions and answers may live in the
 * same block, in adjacent blocks, or even across paragraphs (e.g. text
 * extracted from Word/PDF where every paragraph becomes its own line), so an
 * open question is held until an answer (or the next question) arrives.
 */
function parseLabeledBlocks(text: string): { input: string; expectedOutput: string | undefined; issue?: string }[] {
  const out: { input: string; expectedOutput: string | undefined; issue?: string }[] = [];
  let pending: { input: string } | null = null;

  const flush = () => {
    if (pending) {
      out.push({ input: pending.input, expectedOutput: undefined, issue: "Expected answer not found for this question." });
      pending = null;
    }
  };

  const paragraphs = text.split(/\n\s*\n/);
  for (const rawBlock of paragraphs) {
    const block = rawBlock.trim();
    if (!block) continue;
    for (const line of block.split(/\r?\n/)) {
      const q = QUESTION_LINE.exec(line);
      const a = ANSWER_LINE.exec(line);
      if (q && q[1].trim()) {
        if (pending) {
          // A new question before the previous one got an answer.
          flush();
        }
        pending = { input: q[1].trim() };
      } else if (a && a[1].trim()) {
        if (pending && pending.input) {
          out.push({ input: pending.input, expectedOutput: a[1].trim() });
          pending = null;
        }
      }
    }
  }
  flush();
  return out;
}

/** Extracts test cases from plain text (labeled blocks, then unlabeled pairs as needs-review). */
export function extractFromText(content: string): ExtractionResult {
  const warnings: string[] = [];
  const text = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  if (!text) return { cases: [], warnings: ["The file is empty."] };

  const blocks = parseLabeledBlocks(text);
  const labeled = blocks.filter((b) => b.expectedOutput);
  const labeledNoAnswer = blocks.filter((b) => !b.expectedOutput);

  let cases: ParsedTestCaseWithMeta[] = [];
  if (labeled.length + labeledNoAnswer.length > 0) {
    cases = [...labeled, ...labeledNoAnswer].map((b) => ({
      input: b.input,
      expectedOutput: b.expectedOutput,
      confidence: b.expectedOutput ? 0.9 : 0.5,
      issue: b.expectedOutput ? undefined : b.issue,
    }));
    if (labeledNoAnswer.length > 0) warnings.push(`${labeledNoAnswer.length} question(s) have no expected answer â€” they need review.`);
    return { cases, warnings };
  }

  // Unlabeled consecutive pairs â€” only trust them when clearly 2-line Q/A lists.
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const pairs: ParsedTestCaseWithMeta[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    if (lines[i].length > 0 && lines[i + 1].length > 0 && lines[i] !== lines[i + 1]) {
      pairs.push({
        input: lines[i],
        expectedOutput: lines[i + 1],
        confidence: 0.35,
        issue: "Unlabeled question/answer pair â€” verify before importing.",
      });
    }
  }
  if (pairs.length >= 2) {
    warnings.push("No labeled questions were found. I paired consecutive lines and marked them for review.");
    return { cases: pairs, warnings };
  }

  warnings.push("We found text, but couldn't confidently identify questions and expected answers.");
  return { cases: [], warnings };
}

/** Splits a markdown table block (rows containing |) into cell arrays. */
function extractMarkdownTables(content: string): string[][] {
  const lines = content.split(/\r?\n/);
  const tables: string[][] = [];
  let current: string[] = [];
  let collecting = false;
  const isSep = (row: string) => /^\s*(?:\|?\s*:?-{3,}:?\s*)+\|?\s*$/.test(row.replace(/-/g, "-"));

  const flush = () => {
    if (current.length > 0) tables.push(current);
    current = [];
    collecting = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("|")) {
      if (!collecting) {
        collecting = true;
        current = [line];
      } else if (current.length === 1 && isSep(line)) {
        current.push(line);
      } else {
        current.push(line);
      }
    } else if (collecting) {
      flush();
    }
  }
  flush();
  return tables.filter(
    (t) => t.length >= 3 && isSep(t[1]) && t[0].includes("|") && t[2].includes("|")
  );
}

/** Splits a table row on | and strips piped content from the cells. */
function splitTableRow(row: string): string[] {
  return row
    .split("|")
    .map((c) => c.trim())
    .filter((c, i, arr) => !(i === 0 && c === "") && !(i === arr.length - 1 && c === ""));
}

/** Extracts test cases from Markdown (tables first, then labeled blocks). */
export function extractFromMarkdown(content: string): ExtractionResult {
  const tables = extractMarkdownTables(content);
  if (tables.length > 0) {
    const cases: ParsedTestCaseWithMeta[] = [];
    const warnings: string[] = [];
    for (const table of tables) {
      const headers = splitTableRow(table[0]);
      const mapping = detectTabularMapping(headers);
      const rows: Record<string, string>[] = [];
      for (let r = 2; r < table.length; r++) {
        const cells = splitTableRow(table[r]);
        const rec: Record<string, string> = {};
        headers.forEach((h, ci) => {
          rec[h] = cells[ci] ?? "";
        });
        rows.push(rec);
      }
      const built = buildCasesFromRecords(rows, mapping);
      built.cases.forEach((b) => {
        if (!b.issue) b.confidence = 0.9;
      });
      cases.push(...built.cases);
      warnings.push(...built.warnings);
    }
    if (cases.length > 0) return { cases, warnings };
  }
  // Fall back to labeled text blocks.
  return extractFromText(content.replace(/\|/g, " "));
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[body.toLowerCase()] ?? m;
  });
}

/** Non-nested table scan â€” returns [rowHeaders, dataRows] using the first alias-heavy row as header. */
function extractHtmlTables(html: string): { headers: string[]; rows: Record<string, string>[] }[] {
  const tables: { headers: string[]; rows: Record<string, string>[] }[] = [];
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(html)) !== null) {
    const inner = m[1];
    const rowsRaw = [...inner.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((x) => x[1]);
    const grid: string[][] = rowsRaw.map((tr) =>
      [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
        decodeEntities(c[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim()
      )
    );
    if (grid.length === 0) continue;
    // Prefer a header row whose cells match field aliases.
    let headerIdx = 0;
    for (let i = 0; i < Math.min(grid.length, 3); i++) {
      if (grid[i].some((c) => classifyHeader(c))) {
        headerIdx = i;
        break;
      }
    }
    const headers = grid[headerIdx];
    const rows: Record<string, string>[] = [];
    for (let r = headerIdx + 1; r < grid.length; r++) {
      const rec: Record<string, string> = {};
      headers.forEach((h, ci) => {
        rec[h] = grid[r][ci] ?? "";
      });
      rows.push(rec);
    }
    if (headers.length > 0) tables.push({ headers, rows });
  }
  return tables;
}

/** Strips HTML to readable text (never executed) and runs the text parser. */
export function extractFromHtml(content: string): ExtractionResult {
  const noScript = content.replace(/<(script|style|noscript|iframe)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const tables = extractHtmlTables(noScript);
  if (tables.length > 0) {
    const cases: ParsedTestCaseWithMeta[] = [];
    const warnings: string[] = [];
    let matched = 0;
    for (const table of tables) {
      const mapping = detectTabularMapping(table.headers);
      const built = buildCasesFromRecords(table.rows, mapping);
      matched += built.cases.length;
      for (const b of built.cases) if (!b.issue) b.confidence = 0.8;
      cases.push(...built.cases);
      warnings.push(...built.warnings);
    }
    if (matched > 0) return { cases, warnings };
  }
  const visible = decodeEntities(noScript.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n");
  return extractFromText(visible);
}

/**
 * Detects the likely structure of pasted/txt content WITHOUT trusting the
 * extension. Pure heuristic â€” the actual extraction below is authoritative.
 */
export function detectPasteKind(content: string): PasteDetection {
  const text = content.replace(/^\uFEFF/, "").trim();
  if (!text) return { kind: "unknown", label: "Empty" };

  // JSON (array or wrapper object).
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return { kind: "json", label: "JSON" };
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.testCases) || Array.isArray(obj.cases) || Array.isArray(obj.data)) {
        return { kind: "json", label: "JSON" };
      }
      return { kind: "json", label: "JSON" };
    }
  } catch {
    /* not whole-document JSON */
  }

  // JSONL: every non-empty line parses as a JSON object.
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length > 1) {
    let allJsonObjects = true;
    for (const line of lines) {
      try {
        const p = JSON.parse(line);
        if (p === null || typeof p !== "object" || Array.isArray(p)) {
          allJsonObjects = false;
          break;
        }
      } catch {
        allJsonObjects = false;
        break;
      }
    }
    if (allJsonObjects) return { kind: "jsonl", label: "JSON Lines" };
  }

  // CSV: a header row with a recognized column + at least one data row.
  const firstLine = lines[0] ?? "";
  if (firstLine.includes(",") && lines.length >= 2) {
    try {
      const cases = extractFromCsv(text);
      if (cases.length > 0) return { kind: "csv", label: "CSV" };
    } catch {
      /* not CSV â€” fall through */
    }
  }

  // Markdown table: a `|...` row directly followed by a `|...|` separator row.
  const mdLines = text.split("\n").map((l) => l.trim());
  for (let i = 0; i < mdLines.length - 1; i++) {
    if (mdLines[i].startsWith("|") && isMdBorder(mdLines[i + 1])) {
      return { kind: "markdown", label: "Markdown" };
    }
  }

  // HTML: an HTML document, or content that clearly contains a table.
  if (/^\s*(<!doctype\s+html|<html\b)[\s>]/i.test(text) || /<table[\s>]/i.test(text)) {
    return { kind: "html", label: "HTML" };
  }

  // Plain-ish structured text (question/answer or line pairs).
  const blocks = parseLabeledBlocks(text);
  if (blocks.length > 0) return { kind: "text", label: "Plain text" };

  return { kind: "text", label: "Plain text" };
}

/** True when a line looks like a Markdown table separator, e.g. `|---|---|---|`. */
function isMdBorder(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|") || !/-/.test(t)) return false;
  return /^[\s|:\-\u2500\u2014]+$/.test(t);
}