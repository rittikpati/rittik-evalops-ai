// Vercel `vercel-build`: applies pending DB migrations at deploy time.
// Uses the existing Drizzle config; skips gracefully when DATABASE_URL is
// unset (e.g. local preview builds where the DB is out of scope).
import { execSync } from "node:child_process";

const url = (process.env.DATABASE_URL ?? "").trim();

if (!url) {
  console.log("[deploy-migrate] DATABASE_URL not set — skipping migration step.");
  process.exit(0);
}

console.log("[deploy-migrate] Applying database migrations…");
try {
  execSync("npx drizzle-kit migrate", { stdio: "inherit" });
  console.log("[deploy-migrate] Migrations applied.");
} catch (err) {
  console.error("[deploy-migrate] Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}