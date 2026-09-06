import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/api";

/**
 * GET /api/settings/system — read-only deployment info for the Settings page.
 * Never exposes the actual key; only whether a provider is configured.
 */
export async function GET(req: NextRequest) {
  const auth = await requireCurrentUser(req);
  if (auth.response) return auth.response;

  const key = process.env.OPENROUTER_API_KEY?.trim() ?? "";
  return NextResponse.json(
    {
      status: "success",
      system: {
        openRouterConfigured: key.length > 0,
        aiProvider: process.env.AI_PROVIDER?.trim() || "auto",
        defaultJudgeModel: process.env.JUDGE_MODEL_ID?.trim() || "openrouter/free",
        hasSupabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      },
    },
    { status: 200 }
  );
}