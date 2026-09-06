import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import type { EvaluationRun } from "@/lib/evaluations/types";

type RunRow = typeof runs.$inferSelect;

function iso(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : value;
}

function toRun(row: RunRow): EvaluationRun {
  return {
    id: row.id,
    ownerId: row.ownerId,
    experimentId: row.experimentId,
    datasetId: row.datasetId,
    datasetName: row.datasetName,
    mode: row.mode,
    modelIds: row.modelIds,
    modelNames: row.modelNames,
    promptTemplate: row.promptTemplate,
    systemPrompt: row.systemPrompt ?? undefined,
    temperature: row.temperature ?? undefined,
    maxTokens: row.maxTokens ?? undefined,
    judgeModelId: row.judgeModelId,
    results: row.results,
    aggregated: row.aggregated,
    errors: row.errors,
    status: row.status,
    total: row.total,
    successful: row.successful,
    failed: row.failed,
    startedAt: iso(row.startedAt),
    completedAt: row.completedAt ? iso(row.completedAt) : undefined,
    createdAt: iso(row.createdAt),
  };
}

export const runsRepository = {
  async getRuns(ownerId?: string): Promise<EvaluationRun[]> {
    const db = getDb();
    const rows = ownerId !== undefined
      ? await db.select().from(runs).where(eq(runs.ownerId, ownerId)).orderBy(desc(runs.createdAt))
      : await db.select().from(runs).orderBy(desc(runs.createdAt));
    return rows.map(toRun);
  },

  async getRun(id: string, ownerId?: string): Promise<EvaluationRun | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(runs)
      .where(ownerId !== undefined ? and(eq(runs.id, id), eq(runs.ownerId, ownerId)) : eq(runs.id, id))
      .limit(1);
    return rows.length > 0 ? toRun(rows[0]) : undefined;
  },

  async getRunsByExperiment(experimentId: string, ownerId?: string): Promise<EvaluationRun[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(runs)
      .where(ownerId !== undefined ? and(eq(runs.experimentId, experimentId), eq(runs.ownerId, ownerId)) : eq(runs.experimentId, experimentId));
    return rows.map(toRun);
  },

  async createRun(
    run: Omit<EvaluationRun, "ownerId" | "createdAt" | "startedAt"> &
      Pick<EvaluationRun, "ownerId"> &
      Partial<Pick<EvaluationRun, "createdAt" | "startedAt">>
  ): Promise<EvaluationRun> {
    const db = getDb();
    const now = new Date();
    const inserted = await db
      .insert(runs)
      .values({
        id: run.id || `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ownerId: run.ownerId,
        experimentId: run.experimentId,
        datasetId: run.datasetId,
        datasetName: run.datasetName,
        mode: run.mode || "mock",
        modelIds: run.modelIds,
        modelNames: run.modelNames,
        promptTemplate: run.promptTemplate,
        systemPrompt: run.systemPrompt ?? null,
        temperature: run.temperature ?? null,
        maxTokens: run.maxTokens ?? null,
        judgeModelId: run.judgeModelId,
        results: run.results,
        aggregated: run.aggregated || [],
        errors: run.errors || [],
        status: run.status || "completed",
        total: run.total,
        successful: run.successful,
        failed: run.failed,
        startedAt: run.startedAt ? new Date(run.startedAt) : now,
        completedAt: run.completedAt ? new Date(run.completedAt) : null,
        createdAt: now,
      })
      .returning();
    return toRun(inserted[0]);
  },

  async updateRun(id: string, patch: Partial<EvaluationRun>): Promise<EvaluationRun | undefined> {
    const db = getDb();
    const set: Record<string, unknown> = {};
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.total !== undefined) set.total = patch.total;
    if (patch.successful !== undefined) set.successful = patch.successful;
    if (patch.failed !== undefined) set.failed = patch.failed;
    if (patch.results !== undefined) set.results = patch.results;
    if (patch.aggregated !== undefined) set.aggregated = patch.aggregated;
    if (patch.errors !== undefined) set.errors = patch.errors;
    if (patch.completedAt !== undefined) set.completedAt = patch.completedAt ? new Date(patch.completedAt) : null;
    if (patch.experimentId !== undefined) set.experimentId = patch.experimentId;
    if (patch.datasetId !== undefined) set.datasetId = patch.datasetId;
    if (patch.mode !== undefined) set.mode = patch.mode;

    const [row] = await db.update(runs).set(set).where(eq(runs.id, id)).returning();
    return row ? toRun(row) : undefined;
  },

  async deleteRun(id: string): Promise<boolean> {
    const db = getDb();
    const rows = await db.delete(runs).where(eq(runs.id, id)).returning();
    return rows.length > 0;
  },

  async deleteRunsByExperiment(experimentId: string, ownerId: string): Promise<number> {
    const db = getDb();
    const rows = await db
      .delete(runs)
      .where(and(eq(runs.experimentId, experimentId), eq(runs.ownerId, ownerId)))
      .returning();
    return rows.length;
  },
};
