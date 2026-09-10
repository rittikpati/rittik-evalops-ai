import { NextResponse } from "next/server";
import postgres from "postgres";

// Lightweight unauthenticated health/liveness probe for uptime monitors
// (Vercel Cron, UptimeRobot, etc.). Never exposes internals or secrets.
export async function GET() {
  const configured = Boolean((process.env.DATABASE_URL ?? "").trim());
  let db: "unconfigured" | "reachable" | "unreachable" = "unconfigured";

  if (configured) {
    db = "reachable";
    const conn = postgres(process.env.DATABASE_URL!, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 5,
      prepare: false,
    });
    try {
      await conn`select 1`;
    } catch {
      db = "unreachable";
    } finally {
      await conn.end({ timeout: 5 }).catch(() => undefined);
    }
  }

  return NextResponse.json(
    {
      status: "success",
      ok: true,
      service: "rittik-evalops-ai",
      time: new Date().toISOString(),
      db,
    },
    { status: 200 }
  );
}