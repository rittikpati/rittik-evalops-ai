import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/api";
import { MAX_UPLOAD_BYTES } from "@/lib/datasets/import";
import { ingestFile, type IngestPreview } from "@/lib/datasets/ingest";

/**
 * POST /api/datasets/upload — INSPECT ONLY (never writes to the DB).
 *
 * Reads the uploaded file, detects its format from CONTENT (not just the
 * extension, so ".json.txt" with JSON inside works), extracts canonical test
 * cases, and returns a preview. The client reviews/edits the preview, then
 * commits via POST /api/datasets/import.
 *
 * Form fields:
 *   file            (required) the upload
 *   sheet           (optional) worksheet name for multi-sheet workbooks
 *   mapping         (optional) JSON {input,expectedOutput,context} column
 *                   override for tabular files -> re-extraction
 *
 * Friendly, non-technical errors, always with a recovery path.
 */
export async function POST(req: NextRequest) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { status: "error", error: "There was a problem reading this upload. Please try again." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { status: "error", error: "No file attached. Choose a file and try again.", code: "NO_FILE" },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json(
      { status: "error", error: "This file looks empty. Try a different file, or paste the data instead.", code: "EMPTY_FILE" },
      { status: 400 }
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mega = MAX_UPLOAD_BYTES / 1024 / 1024;
    return NextResponse.json(
      {
        status: "error",
        error: `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the maximum is ${mega} MB. Split it into smaller files or paste the data.`,
        code: "FILE_TOO_LARGE",
      },
      { status: 400 }
    );
  }

  let mapping: { input?: string; expectedOutput?: string; context?: string } | undefined;
  const mappingRaw = form.get("mapping");
  if (typeof mappingRaw === "string" && mappingRaw.trim()) {
    try {
      mapping = JSON.parse(mappingRaw);
    } catch {
      return NextResponse.json(
        { status: "error", error: "The column mapping couldn't be read. Please try again.", code: "MALFORMED" },
        { status: 400 }
      );
    }
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await ingestFile(bytes, file.name, {
    ...(typeof form.get("sheet") === "string" ? { sheet: form.get("sheet") as string } : {}),
    ...(mapping ? { mappingOverride: mapping } : {}),
  });

  if (!result.ok) {
    return NextResponse.json(
      { status: "error", error: result.message, code: result.code },
      { status: result.code === "UNSUPPORTED_TYPE" ? 415 : 400 }
    );
  }

  const preview = result.preview;
  return NextResponse.json(statusSuccess(preview), { status: 200 });
}

function statusSuccess(preview: IngestPreview) {
  return {
    status: "success",
    detection: preview.detection,
    file: preview.file,
    summary: preview.summary,
    cases: preview.cases,
    columns: preview.columns,
    rawRecords: preview.rawRecords,
    mapping: preview.mapping,
    warnings: preview.warnings,
  };
}