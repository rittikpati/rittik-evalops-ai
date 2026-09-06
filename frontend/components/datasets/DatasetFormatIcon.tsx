"use client";

import {
  FileJson,
  FileType,
  FileSpreadsheet,
  FileText,
  FileImage,
  FileQuestion,
} from "lucide-react";

/** Icon for a dataset source format. Static JSX per branch so React Compiler treats it as stable. */
export function DatasetFormatIcon({ format, className }: { format: string; className?: string }) {
  switch (format) {
    case "json":
    case "jsonl":
      return <FileJson className={className} />;
    case "csv":
      return <FileType className={className} />;
    case "xlsx":
      return <FileSpreadsheet className={className} />;
    case "image":
      return <FileImage className={className} />;
    case "unknown":
      return <FileQuestion className={className} />;
    default:
      return <FileText className={className} />;
  }
}