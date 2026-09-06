import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/api";
import { ingestPaste } from "@/lib/datasets/ingest";

const MAX_PASTE_CHARS = 1_500_000;

/**
 * POST /api/datasets/paste — detect + extract pasted content for preview.
 * Never writes to the DB; the client reviews and commits via /import.
 * Body: { content: string, mapping?: {input,expectedOutput,context} }
 */
export async function POST(req: NextRequest) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "We couldn't read what you pasted. Please try again.", code: "MALFORMED" },
      { status: 400 }
    );
  }
  const b = body as { content?: unknown; mapping?: { input?: string; expectedOutput?: string; context?: string } };
  if (typeof b.content !== "string" || !b.content.trim()) {
    return NextResponse.json(
      { status: "error", error: "Nothing to detect — paste some data first.", code: "NO_CONTENT" },
      { status: 400 }
    );
  }
  if (b.content.length > MAX_PASTE_CHARS) {
    return NextResponse.json(
      {
        status: "error",
        error: `That's a lot of text (${(b.content.length / 1000).toFixed(0)} KB). Paste it in smaller chunks.`,
        code: "TOO_LARGE",
      },
      { status: 400 }
    );
  }

  let mapping: { input?: string; expectedOutput?: string; context?: string } | undefined;
  if (b.mapping) {
    mapping = {
      ...(typeof b.mapping.input === "string" ? { input: b.mapping.input } : {}),
      ...(typeof b.mapping.expectedOutput === "string" ? { expectedOutput: b.mapping.expectedOutput } : {}),
      ...(typeof b.mapping.context === "string" ? { context: b.mapping.context } : {}),
    };
  }

  const preview = ingestPaste(b.content, "pasted-data.txt", mapping ? { mappingOverride: mapping } : {});

  return NextResponse.json(
    {
      status: "success",
      detection: preview.detection,
      file: preview.file,
      summary: preview.summary,
      cases: preview.cases,
      columns: preview.columns,
      rawRecords: preview.rawRecords,
      mapping: preview.mapping,
      warnings: preview.warnings,
    },
    { status: 200 }
  );
}