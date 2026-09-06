import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/api";
import { implementedFormats } from "@/lib/datasets/ingest";

/** GET /api/datasets/formats — the formats ACTUALLY implemented in this deployment. */
export async function GET(req: NextRequest) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;
  return NextResponse.json({ status: "success", formats: implementedFormats() }, { status: 200 });
}