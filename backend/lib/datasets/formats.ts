import type { DatasetSourceFormat } from "@/types";

export type DetectionFormat = DatasetSourceFormat | "image" | "unknown";

export interface FormatInfo {
  id: DetectionFormat;
  /** Human label shown to users ("Excel workbook"). */
  label: string;
  /** Short label for badges ("XLSX"). */
  shortLabel: string;
  extensions: string[];
  /** 1 = always-on core, 2 = document/web, 3 = OCR (optional). */
  tier: 1 | 2 | 3;
  /** True when parsing runs entirely in pure TS (no runtime npm deps). */
  pure: boolean;
  description: string;
}

export const SOURCE_FORMATS: Record<DetectionFormat, FormatInfo> = {
  json: {
    id: "json",
    label: "JSON",
    shortLabel: "JSON",
    extensions: ["json"],
    tier: 1,
    pure: true,
    description: "An array of objects (or { testCases / cases / data } wrapper).",
  },
  jsonl: {
    id: "jsonl",
    label: "JSON Lines",
    shortLabel: "JSONL",
    extensions: ["jsonl"],
    tier: 1,
    pure: true,
    description: "One JSON object per line.",
  },
  csv: {
    id: "csv",
    label: "CSV (spreadsheet)",
    shortLabel: "CSV",
    extensions: ["csv"],
    tier: 1,
    pure: true,
    description: "Comma-separated values with a header row.",
  },
  xlsx: {
    id: "xlsx",
    label: "Excel workbook",
    shortLabel: "XLSX",
    extensions: ["xlsx", "xls"],
    tier: 1,
    pure: false,
    description: "Microsoft Excel workbooks (.xlsx / .xls) with a header row.",
  },
  txt: {
    id: "txt",
    label: "Plain text",
    shortLabel: "TXT",
    extensions: ["txt"],
    tier: 1,
    pure: true,
    description: "Plain text with labeled Question / Answer blocks (or unlabeled pairs).",
  },
  markdown: {
    id: "markdown",
    label: "Markdown",
    shortLabel: "MD",
    extensions: ["md", "markdown"],
    tier: 2,
    pure: true,
    description: "Markdown tables (| Question | Answer |) and Q/A blocks.",
  },
  html: {
    id: "html",
    label: "HTML",
    shortLabel: "HTML",
    extensions: ["html", "htm"],
    tier: 2,
    pure: true,
    description: "HTML tables and visible text. Never executed.",
  },
  pdf: {
    id: "pdf",
    label: "PDF",
    shortLabel: "PDF",
    extensions: ["pdf"],
    tier: 2,
    pure: false,
    description: "Text-based PDFs. Scanned/image-only PDFs fall back to manual entry.",
  },
  docx: {
    id: "docx",
    label: "Word document",
    shortLabel: "DOCX",
    extensions: ["docx"],
    tier: 2,
    pure: false,
    description: "Microsoft Word documents (.docx) â€” paragraphs and tables.",
  },
  image: {
    id: "image",
    label: "Image / scan",
    shortLabel: "IMAGE",
    extensions: ["png", "jpg", "jpeg", "webp"],
    tier: 3,
    pure: false,
    description: "Images and scanned pages. OCR is not enabled in this deployment.",
  },
  parquet: {
    id: "parquet",
    label: "Parquet",
    shortLabel: "PARQUET",
    extensions: ["parquet"],
    tier: 3,
    pure: false,
    description: "Apache Parquet files are not supported by this deployment yet.",
  },
  unknown: {
    id: "unknown",
    label: "Other / unknown",
    shortLabel: "OTHER",
    extensions: [],
    tier: 3,
    pure: false,
    description: "A file type we could not confidently detect.",
  },
};

/** Ordered, tier-first list used by the UI. */
export const FORMAT_ORDER: DetectionFormat[] = [
  "json",
  "jsonl",
  "csv",
  "xlsx",
  "txt",
  "markdown",
  "html",
  "pdf",
  "docx",
  "image",
  "parquet",
];

/** Looks a format up by file extension (lowercased, no dot). */
export function formatByExtension(ext: string): DetectionFormat | null {
  const e = ext.toLowerCase();
  for (const id of FORMAT_ORDER) {
    if (SOURCE_FORMATS[id].extensions.includes(e)) return id;
  }
  return null;
}

/** Label for a stored dataset.format value ("csv" â†’ "CSV (spreadsheet)"). */
export function labelForDatasetFormat(format: string): string {
  const info = SOURCE_FORMATS[format as DetectionFormat];
  return info ? info.label : format.toUpperCase();
}