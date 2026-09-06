import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { modelToggles } from "@/lib/db/schema";

/** Returns the enabled map for a user. Missing entries fall back to "enabled". */
export async function getModelEnabledMap(ownerId: string): Promise<Map<string, boolean>> {
  if (!process.env.DATABASE_URL?.trim()) return new Map();
  const rows = await getDb()
    .select({ modelId: modelToggles.modelId, enabled: modelToggles.enabled })
    .from(modelToggles)
    .where(eq(modelToggles.ownerId, ownerId));
  const map = new Map<string, boolean>();
  for (const row of rows) map.set(row.modelId, row.enabled);
  return map;
}

/** Upserts the enabled state for a user + model pair. */
export async function setModelEnabled(ownerId: string, modelId: string, enabled: boolean): Promise<void> {
  const db = getDb();
  await db
    .insert(modelToggles)
    .values({ ownerId, modelId, enabled })
    .onConflictDoUpdate({
      target: [modelToggles.ownerId, modelToggles.modelId],
      set: { enabled },
    });
}

/** Removes a persisted toggle (used when a custom model is deleted). */
export async function deleteModelToggle(ownerId: string, modelId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(modelToggles)
    .where(and(eq(modelToggles.ownerId, ownerId), eq(modelToggles.modelId, modelId)));
}