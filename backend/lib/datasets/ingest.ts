import {
  detectPasteKind,
  detectTabularMapping,
  extractFromCsv,
  extractFromHtml,
  extractFromMarkdown,
  extractFromText,
  extractTestCases,
  normalizeRecord,
  parseCsv,
  buildCasesFromRecords,
  type ParsedTestCaseWithMeta,
  type TabularMapping,
} from "./import";
import { FORMAT_ORDER, SOURCE_FORMATS, formatByExtension, type DetectionFormat } from "./formats";

export const MAX_PREVIEW_CASES = 20000;
const MAX_RAW_ROWS = MAX_PREVIEW_CASES;

export interface IngestPreview {
  detection: {
    kind: DetectionFormat;
    label: string;
    extension: string | null;
    /** Human note when the extension disagrees with the detected content (e.g. JSON in a .txt file). */
    extensionMessage: string | null;
    needsReview: boolean;
    /** Friendly explanation when nothing usable could be extracted. */
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

export interface IngestOptions {
  bytes?: Uint8Array;
  content?: string;
  filename: string;
  /** Optional explicit sheet for multi-sheet workbooks. */
  sheet?: string;
  /** Optional re-map for tabular sources (column names the user picked). */
  mappingOverride?: { input?: string; expectedOutput?: string; context?: string };
}

export type IngestKindError = { ok: false; code: string; message: string };

export type IngestResult = { ok: true; preview: IngestPreview } | IngestKindError;

function caps<T>(arr: T[], limit: number): T[] {
  return arr.slice(0, limit);
}

function toMeta(cases: { input: string; expectedOutput?: string; context?: string }[], skipped = 0): {
  cases: ParsedTestCaseWithMeta[];
  warnings: string[];
} {
  return {
    cases: cases.map((c) => ({ ...c, confidence: 1 })),
    warnings: skipped > 0 ? [`${skipped} entr${skipped === 1 ? "y was" : "ies were"} skipped (missing a question/input).`] : [],
  };
}

function summarize(cases: ParsedTestCaseWithMeta[]): { total: number; valid: number; needsReview: number } {
  let valid = 0;
  for (const c of cases) {
    if (c.input && !c.issue && c.confidence >= 0.6) valid++;
  }
  return { total: cases.length, valid, needsReview: cases.length - valid };
}

/** Extracts text from a buffer via pdf-parse (lazy). Thrown â†’ caller reports unsupported. */
async function parsePdfText(bytes: Uint8Array): Promise<string> {
  const mod = (await import("pdf-parse")) as Record<string, unknown>;
  const modDefault = mod.default as Record<string, unknown> | undefined;
  const PDFParse = (mod.PDFParse ?? modDefault?.PDFParse) as
    | (new (opts: { data: Buffer }) => { getText(): Promise<{ text?: string }>; destroy(): Promise<void> })
    | undefined;
  if (!PDFParse) throw new Error("pdf parser unavailable");
  const parser = new PDFParse({ data: Buffer.from(bytes) });
  try {
    const result = await parser.getText();
    return result?.text ?? "";
  } finally {
    await parser.destroy();
  }
}

/** Extracts text from a .docx buffer via mammoth (lazy). Thrown â†’ caller reports unsupported. */
async function parseDocxText(bytes: Uint8Array): Promise<string> {
  const mod = (await import("mammoth")) as Record<string, unknown>;
  const modDefault = mod.default as Record<string, unknown> | undefined;
  const extract = (mod.extractRawText ?? modDefault?.extractRawText) as
    | ((opts: { buffer: Buffer }) => Promise<{ value?: string }>)
    | undefined;
  if (!extract) throw new Error("docx parser unavailable");
  const result = await extract({ buffer: Buffer.from(bytes) });
  return result?.value ?? "";
}

function sniffBinary(bytes: Uint8Array): "pdf" | "zip" | null {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 8));
  if (head.startsWith("%PDF-")) return "pdf";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "zip"; // PK
  return null;
}

/** Maps raw tabular rows straight from a string[][] grid (csv/xlsx/markdown tables). */
function buildTabularFromGrid(grid: string[][], opts: IngestOptions): IngestPreview {
  const raw: string[][] = grid.filter((r) => r.some((c) => c.trim().length > 0));
  if (raw.length < 2) {
    return {
      detection: {
        kind: "csv",
        label: "CSV (spreadsheet)",
        extension: extOf(opts.filename),
        extensionMessage: null,
        needsReview: false,
        message: "This spreadsheet has a header row but no data rows to import.",
        sheets: [],
      },
      file: { name: opts.filename, sizeBytes: opts.bytes?.byteLength ?? 0 },
      summary: { total: 0, valid: 0, needsReview: 0, skipped: 0 },
      cases: [],
      columns: raw[0] ?? [],
      rawRecords: [],
      mapping: null,
      warnings: [],
    };
  }

  const headers = raw[0].map((h) => h.trim());
  let mapping = detectTabularMapping(headers);
  if (opts.mappingOverride) {
    mapping = {
      headers,
      input: opts.mappingOverride.input || mapping.input,
      expectedOutput: opts.mappingOverride.expectedOutput || mapping.expectedOutput,
      context: opts.mappingOverride.context || mapping.context,
      lowConfidence: false,
    };
  }

  let records = raw.slice(1).map((row) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h] = row[i] ?? "";
    });
    return rec;
  });

  const skipped = records.length - Math.min(records.length, MAX_RAW_ROWS);
  records = caps(records, MAX_RAW_ROWS);

  const built = buildCasesFromRecords(records, mapping);
  const total = built.cases.length;
  const valid = built.cases.filter((c) => c.input && !c.issue && c.confidence >= 0.6).length;
  const warnings = [...built.warnings];
  if (skipped > 0) warnings.push(`Only the first ${MAX_RAW_ROWS} rows are shown here. Review them, or split the data into smaller files.`);

  return {
    detection: {
      kind: "csv",
      label: "CSV (spreadsheet)",
      extension: extOf(opts.filename),
      extensionMessage: null,
      needsReview: built.cases.some((c) => !c.input || c.issue || c.confidence < 0.6) || mapping.lowConfidence,
      message: total === 0 ? "We couldn't find a question/input column in this spreadsheet." : null,
      sheets: [],
    },
    file: { name: opts.filename, sizeBytes: opts.bytes?.byteLength ?? 0 },
    summary: { total, valid, needsReview: total - valid, skipped },
    cases: built.cases,
    columns: headers,
    rawRecords: records,
    mapping,
    warnings,
  };
}

function extOf(filename: string): string | null {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : null;
}

/** Shared path for text content (paste or decoded file). */
function ingestTextContent(content: string, opts: IngestOptions, ext: string | null): IngestPreview {
  const kind = detectPasteKind(content);

  // Strict paths when the extension claims a pure text format.
  if (ext === "json") {
    try {
      const parsed = JSON.parse(content.replace(/^\uFEFF/, ""));
      const { cases, skipped } = extractTestCases(parsed);
      const meta = toMeta(cases, skipped);
      return finalize(
        "json",
        "JSON",
        content,
        opts,
        meta.cases,
        meta.warnings,
        0,
        kind.kind !== "json" ? `The file is named .${ext}, but its content isn't valid JSON (it looks like ${kind.label}). We imported it as ${kind.label.toLowerCase()} instead.` : null
      );
    } catch {
      // JSON-parse failed â€” fall through to content detection below.
    }
  }
  if (ext === "jsonl") {
    const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const cases: ParsedTestCaseWithMeta[] = [];
    const warnings: string[] = [];
    let badLine = -1;
    lines.forEach((line, i) => {
      if (badLine >= 0) return;
      try {
        const p = JSON.parse(line);
        if (p && typeof p === "object" && !Array.isArray(p)) {
          const tc = normalizeRecord(p as Record<string, unknown>);
          if (tc) cases.push({ ...tc, confidence: 1 });
          else warnings.push(`Line ${i + 1} has no question/input field and was skipped.`);
        } else {
          badLine = i + 1;
        }
      } catch {
        badLine = i + 1;
      }
    });
    if (badLine >= 0) {
      return finalize(
        "jsonl",
        "JSON Lines",
        content,
        opts,
        [],
        [`JSONL requires one JSON object per line. Line ${badLine} isn't valid JSON.`],
        0,
        null,
        cases.length > 0 ? `We extracted ${cases.length} rows before line ${badLine}. Review and fix that line, then re-import.` : null
      );
    }
    if (cases.length === 0) {
      return finalize("jsonl", "JSON Lines", content, opts, [], ["This JSONL file has no rows with a question/input field."], 0, null);
    }
    return finalize("jsonl", "JSON Lines", content, opts, cases, warnings, 0, kind.kind !== "jsonl" ? `The file is named .${ext} â€” we treated it as JSON Lines.` : null);
  }
  if (ext === "csv") {
    try {
      void extractFromCsv(content);
      const grid = parseCsv(content.replace(/^\uFEFF/, ""));
      return buildTabularFromGrid(grid, opts);
    } catch {
      // MISSING_FIELDS â†’ try content detection below.
    }
  }

  // Content-first detection (covers .json.txt, pastes, unknown extensions).
  switch (kind.kind) {
    case "json": {
      let parsed: unknown;
      try {
        parsed = JSON.parse(content.replace(/^\uFEFF/, ""));
      } catch {
        return finalize("json", "JSON", content, opts, [], ["The file contains JSON, but its structure appears incomplete."], 0, null, "Import the corrected file again, paste the data, or create cases manually.");
      }
      const { cases, skipped } = extractTestCases(parsed);
      const meta = toMeta(cases, skipped);
      return finalize("json", "JSON", content, opts, meta.cases, meta.warnings, 0, ext && ext !== "json" ? `JSON data found in a .${ext} file.` : null);
    }
    case "jsonl": {
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const cases: ParsedTestCaseWithMeta[] = [];
      const warnings: string[] = [];
      lines.forEach((line, i) => {
        try {
          const p = JSON.parse(line);
          if (p && typeof p === "object" && !Array.isArray(p)) {
            const tc = normalizeRecord(p as Record<string, unknown>);
            if (tc) cases.push({ ...tc, confidence: 1 });
            else warnings.push(`Line ${i + 1} has no question/input field and was skipped.`);
          } else {
            warnings.push(`Line ${i + 1} isn't a JSON object and was skipped.`);
          }
        } catch {
          warnings.push(`Line ${i + 1} isn't valid JSON and was skipped.`);
        }
      });
      return finalize("jsonl", "JSON Lines", content, opts, cases, warnings, 0, ext && ext !== "jsonl" ? `JSON Lines data found in a .${ext} file.` : null);
    }
    case "csv": {
      const grid = parseCsv(content.replace(/^\uFEFF/, ""));
      return buildTabularFromGrid(grid, opts);
    }
    case "markdown": {
      const result = extractFromMarkdown(content);
      return finalize("markdown", "Markdown", content, opts, result.cases, result.warnings, 0, null);
    }
    case "html": {
      const result = extractFromHtml(content);
      return finalize("html", "HTML", content, opts, result.cases, result.warnings, 0, null, result.cases.length === 0 ? (result.unreadable ? "We couldn't read any table or text from this HTML. Paste the content or create cases manually." : null) : null);
    }
    default: {
      const result = extractFromText(content);
      return finalize(
        "txt",
        "Plain text",
        content,
        opts,
        result.cases,
        result.warnings,
        0,
        null,
        result.cases.length === 0 ? "We found text, but couldn't confidently identify the questions and expected answers." : null
      );
    }
  }
}

function finalize(
  kind: DetectionFormat,
  label: string,
  content: string,
  opts: IngestOptions,
  cases: ParsedTestCaseWithMeta[],
  warnings: string[],
  skipped: number,
  extensionMessage: string | null,
  message: string | null = null
): IngestPreview {
  const capped = caps(cases, MAX_PREVIEW_CASES);
  if (cases.length > MAX_PREVIEW_CASES) warnings.push(`Only the first ${MAX_PREVIEW_CASES} test cases are shown here. Review them, or split the data into smaller files.`);
  const summary = summarize(capped);
  return {
    detection: {
      kind,
      label,
      extension: extOf(opts.filename),
      extensionMessage: extensionMessage,
      needsReview: summary.needsReview > 0 || warnings.length > 0,
      message,
      sheets: [],
    },
    file: { name: opts.filename, sizeBytes: opts.bytes?.byteLength ?? content.length },
    summary: { ...summary, skipped },
    cases: capped,
    columns: [],
    rawRecords: [],
    mapping: null,
    warnings,
  };
}

/** Detects + extracts a file upload for preview. Never writes to the DB. */
export async function ingestFile(bytes: Uint8Array, filename: string, opts: Partial<Omit<IngestOptions, "bytes" | "content" | "filename">> = {}): Promise<IngestResult> {
  const ext = extOf(filename);
  const detected = ext ? formatByExtension(ext) : null;
  const binary = detected === "xlsx" || detected === "pdf" || detected === "docx" || detected === "image";

  const file = { name: filename, sizeBytes: bytes.byteLength };

  if (binary) {
    // Look INSIDE the file rather than trusting the extension completely.
    const sniff = sniffBinary(bytes);
    let kind: DetectionFormat = detected ?? "unknown";
    if (detected === "xlsx" && sniff !== "zip") kind = "unknown";
    if (detected === "docx" && sniff !== "zip") kind = "unknown";
    if (detected === "pdf" && sniff !== "pdf") kind = "unknown";

    if (kind === "image" || detected === "image") {
      return {
        ok: true,
        preview: {
          detection: {
            kind: "image",
            label: "Image / scan",
            extension: ext,
            extensionMessage: null,
            needsReview: false,
            message: "This looks like an image or scanned page. Reliable OCR isn't enabled in this deployment, so we can't extract test cases. You can paste the content or create the test cases manually.",
            sheets: [],
          },
          file,
          summary: { total: 0, valid: 0, needsReview: 0, skipped: 0 },
          cases: [],
          columns: [],
          rawRecords: [],
          mapping: null,
          warnings: [],
        },
      };
    }

    if (kind === "xlsx") {
      try {
        const mod = (await import("xlsx")) as Record<string, unknown>;
        const XLSX = (mod?.default ?? mod) as {
          read: (data: Uint8Array, opts: { type: "array" }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
          utils: { sheet_to_json: (sheet: unknown, opts: Record<string, unknown>) => string[][] };
        };
        const wb = XLSX.read(bytes, { type: "array" });
        const sheets: string[] = wb.SheetNames ?? [];
        const chosen = opts.sheet && sheets.includes(opts.sheet) ? opts.sheet : sheets[0];
        if (!chosen) {
          return { ok: false, code: "EMPTY_FILE", message: "This workbook has no worksheets with data to import." };
        }
        const grid: string[][] = XLSX.utils.sheet_to_json(wb.Sheets[chosen], { header: 1, raw: false, blankrows: false });
        const preview = buildTabularFromGrid(grid, { ...opts, filename, bytes });
        preview.detection.kind = "xlsx";
        preview.detection.label = "Excel workbook";
        preview.detection.sheets = sheets;
        return { ok: true, preview };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        if (/parse|format|corrupt/i.test(msg)) {
          return { ok: false, code: "PARSE_ERROR", message: "This file looks like an Excel workbook, but we couldn't read its sheets. If it's really a .zip renamed to .xlsx, try saving it from Excel as .xlsx again." };
        }
        return { ok: false, code: "PARSE_ERROR", message: "XLSX reading isn't available in this deployment. You can paste the data as CSV instead." };
      }
    }

    if (kind === "docx") {
      try {
        const text = await parseDocxText(bytes);
        const result = extractFromText(text);
        const preview = finalize("docx", "Word document", text, { ...opts, filename, bytes }, result.cases, result.warnings, 0, null, result.cases.length === 0 ? "We couldn't extract test cases from this Word document. Paste the content or create cases manually." : null);
        return { ok: true, preview };
      } catch {
        return { ok: false, code: "PARSE_ERROR", message: "DOCX reading isn't available in this deployment. You can paste the content or create cases manually." };
      }
    }

    if (kind === "pdf") {
      try {
        const text = await parsePdfText(bytes);
        const trimmed = text.replace(/\s+/g, " ").trim();
        if (!trimmed) {
          return {
            ok: true,
            preview: {
              detection: {
                kind: "pdf",
                label: "PDF",
                extension: ext,
                extensionMessage: null,
                needsReview: false,
                message: "This appears to be a scanned or image-only PDF. We couldn't reliably extract the text. You can paste the content or create the test cases manually.",
                sheets: [],
              },
              file,
              summary: { total: 0, valid: 0, needsReview: 0, skipped: 0 },
              cases: [],
              columns: [],
              rawRecords: [],
              mapping: null,
              warnings: [],
            },
          };
        }
        const result = extractFromText(text);
        const preview = finalize("pdf", "PDF", text, { ...opts, filename, bytes }, result.cases, result.warnings, 0, null, result.cases.length === 0 ? "We couldn't reliably extract test cases from this PDF. You can paste the content or create cases manually." : null);
        return { ok: true, preview };
      } catch {
        return { ok: false, code: "PARSE_ERROR", message: "PDF reading isn't available in this deployment. You can paste the content or create cases manually." };
      }
    }

    // Unknown/other non-text binary.
    const text = sniff === null ? "" : new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (text && text.trim().length > 0) {
      return { ok: true, preview: ingestTextContent(text, { ...opts, filename, bytes }, ext) };
    }
    return {
      ok: false,
      code: "UNSUPPORTED_TYPE",
      message: "This file type isn't currently supported. Try a text, CSV, Excel, Word, PDF, or JSON file â€” or paste the data directly.",
    };
  }

  // Pure text formats: decode and run the shared text pipeline.
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const preview = ingestTextContent(text, { ...opts, filename, bytes }, ext);
  return { ok: true, preview };
}

/** Detects + extracts pasted content for preview. Never writes to the DB. */
export function ingestPaste(content: string, filename = "pasted-data.txt", opts: Partial<Omit<IngestOptions, "bytes" | "content" | "filename">> = {}): IngestPreview {
  return ingestTextContent(content, { ...opts, filename, content }, extOf(filename));
}

/** Human list of formats currently implemented in this deployment. */
export function implementedFormats(): { id: string; label: string; shortLabel: string; tier: number; description: string }[] {
  return FORMAT_ORDER.filter((id) => id !== "unknown" && id !== "image" && id !== "parquet").map((id) => {
    const info = SOURCE_FORMATS[id];
    return {
      id,
      label: info.label,
      shortLabel: info.shortLabel,
      tier: info.tier,
      description: info.description,
    };
  });
}