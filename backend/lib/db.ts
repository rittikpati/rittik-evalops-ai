import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./db/schema";

/** Reads the Supabase Postgres connection string (pooler or direct). */
function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. In Supabase: Project Settings -> Database -> Connection string. Add it to .env.local (dev) or the deployment dashboard (prod). It is never bundled to the client."
    );
  }
  return url;
}

let cached: ReturnType<typeof makeClient> | undefined;

function makeClient() {
  // Small pool (5) lets concurrent page-load API calls (session/experiments/
  // evaluations/datasets run in parallel) avoid serializing behind one
  // connection. Free-tier Supabase direct connections allow well beyond this.
  const connection = postgres(databaseUrl(), { max: 5, prepare: false });
  return drizzle(connection, { schema });
}

/**
 * Returns the Drizzle instance backed by the Supabase Postgres connection.
 * Cached so hot reloads reuse the same pool. Throws fast if DATABASE_URL is
 * missing so a misconfigured server fails loudly instead of degrading.
 */
export function getDb() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "DATABASE_URL is not set. Add your Supabase Postgres connection string to .env.local / the deployment dashboard (see .env.example)."
    );
  }
  if (!cached) {
    cached = makeClient();
  }
  return cached;
}
