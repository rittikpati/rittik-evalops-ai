/**
 * RittikEvalOpsAI — Drizzle Kit config (Supabase PostgreSQL).
 *
 * Generates SQL migrations into ./drizzle from the Postgres schema.
 * `DATABASE_URL` must point at a Supabase Postgres connection string to run
 * migrations/push. Free-tier compatible — migrations are plain Postgres SQL.
 */

import type { Config } from "drizzle-kit";

export default {
  schema: "./backend/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
} satisfies Config;
