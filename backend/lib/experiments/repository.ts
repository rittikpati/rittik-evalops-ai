import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { experiments } from "@/lib/db/schema";
import type { Experiment, ExperimentMetrics } from "@/types";

export type ExperimentStatus = Experiment["status"];

export interface ExperimentRecord extends Experiment {
  modelNames?: string[];
  promptTemplate?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  judgeModelId?: string;
  evaluationRunId?: string;
}

type ExperimentRow = typeof experiments.$inferSelect;

function iso(value: Date | string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function toExperimentRecord(row: ExperimentRow): ExperimentRecord {
  const metrics =
    row.metrics && Object.keys(row.metrics).length > 0
      ? (row.metrics as unknown as ExperimentMetrics)
      : undefined;
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    description: row.description ?? undefined,
    datasetId: row.datasetId,
    datasetName: row.datasetName,
    models: row.models,
    modelNames: row.modelNames,
    status: row.status,
    progress: row.progress,
    totalTestCases: row.totalTestCases,
    completedTestCases: row.completedTestCases,
    promptTemplate: row.promptTemplate,
    systemPrompt: row.systemPrompt ?? undefined,
    temperature: row.temperature ?? undefined,
    maxTokens: row.maxTokens ?? undefined,
    judgeModelId: row.judgeModelId ?? undefined,
    evaluationRunId: row.evaluationRunId ?? undefined,
    metrics,
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    createdAt: iso(row.createdAt) ?? "",
    updatedAt: iso(row.updatedAt) ?? "",
  };
}

export const experimentRepository = {
  async getExperiments(ownerId?: string): Promise<ExperimentRecord[]> {
    const db = getDb();
    const rows = ownerId !== undefined
      ? await db.select().from(experiments).where(eq(experiments.ownerId, ownerId)).orderBy(desc(experiments.createdAt))
      : await db.select().from(experiments).orderBy(desc(experiments.createdAt));
    return rows.map(toExperimentRecord);
  },

  async getExperiment(id: string, ownerId?: string): Promise<ExperimentRecord | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(experiments)
      .where(ownerId !== undefined ? and(eq(experiments.id, id), eq(experiments.ownerId, ownerId)) : eq(experiments.id, id))
      .limit(1);
    return rows.length > 0 ? toExperimentRecord(rows[0]) : undefined;
  },

  async createExperiment(
    input: Omit<ExperimentRecord, "id" | "ownerId" | "createdAt" | "updatedAt" | "progress" | "completedTestCases"> &
      Pick<ExperimentRecord, "ownerId"> &
      Partial<Pick<ExperimentRecord, "id" | "progress" | "completedTestCases">>
  ): Promise<ExperimentRecord> {
    const db = getDb();
    const now = new Date();
    const inserted = await db
      .insert(experiments)
      .values({
        id: input.id ?? `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ownerId: input.ownerId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        datasetId: input.datasetId,
        datasetName: input.datasetName,
        models: input.models,
        modelNames: input.modelNames || input.models,
        promptTemplate: input.promptTemplate || "Answer {{question}}",
        systemPrompt: input.systemPrompt ?? null,
        temperature: input.temperature ?? null,
        maxTokens: input.maxTokens ?? null,
        judgeModelId: input.judgeModelId ?? null,
        status: input.status || "draft",
        progress: input.progress ?? 0,
        totalTestCases: input.totalTestCases,
        completedTestCases: input.completedTestCases ?? 0,
        metrics:
          input.metrics && Object.keys(input.metrics).length > 0
            ? (input.metrics as unknown as Record<string, number>)
            : null,
        startedAt: input.startedAt ? new Date(input.startedAt) : null,
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toExperimentRecord(inserted[0]);
  },

  async updateExperiment(
    id: string,
    ownerId: string,
    patch: Partial<ExperimentRecord>
  ): Promise<ExperimentRecord | undefined> {
    const db = getDb();
    const existing = await db
      .select()
      .from(experiments)
      .where(and(eq(experiments.id, id), eq(experiments.ownerId, ownerId)))
      .limit(1);
    if (existing.length === 0) return undefined;
    const ex = existing[0];

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.description !== undefined) set.description = patch.description || null;
    if (patch.status !== undefined) set.status = patch.status as ExperimentStatus;
    if (patch.progress !== undefined) set.progress = patch.progress;
    if (patch.totalTestCases !== undefined) set.totalTestCases = patch.totalTestCases;
    if (patch.completedTestCases !== undefined) set.completedTestCases = patch.completedTestCases;
    if (patch.promptTemplate !== undefined) set.promptTemplate = patch.promptTemplate;
    if (patch.systemPrompt !== undefined) set.systemPrompt = patch.systemPrompt ?? null;
    if (patch.temperature !== undefined) set.temperature = patch.temperature;
    if (patch.maxTokens !== undefined) set.maxTokens = patch.maxTokens;
    if (patch.judgeModelId !== undefined) set.judgeModelId = patch.judgeModelId;
    if (patch.datasetId !== undefined) set.datasetId = patch.datasetId;
    if (patch.datasetName !== undefined) set.datasetName = patch.datasetName;
    if (patch.models !== undefined) set.models = patch.models;
    if (patch.modelNames !== undefined) set.modelNames = patch.modelNames;
    if (patch.metrics !== undefined && Object.keys(patch.metrics).length > 0) {
      set.metrics = patch.metrics as unknown as Record<string, number>;
    }
    if (patch.evaluationRunId !== undefined) set.evaluationRunId = patch.evaluationRunId;
    if ((patch.status === "completed" || patch.status === "failed") && !ex.completedAt) {
      set.completedAt = new Date();
    }
    if (patch.status === "running" && !ex.startedAt) set.startedAt = new Date();
    if (patch.completedAt !== undefined) set.completedAt = patch.completedAt ? new Date(patch.completedAt) : null;
    if (patch.startedAt !== undefined) set.startedAt = patch.startedAt ? new Date(patch.startedAt) : null;

    const [row] = await db
      .update(experiments)
      .set(set)
      .where(eq(experiments.id, id))
      .returning();
    return toExperimentRecord(row);
  },

  async deleteExperiment(id: string, ownerId: string): Promise<boolean> {
    const db = getDb();
    const rows = await db
      .delete(experiments)
      .where(and(eq(experiments.id, id), eq(experiments.ownerId, ownerId)))
      .returning();
    return rows.length > 0;
  },

  /** Links an evaluation run to an experiment, mirroring the old in-memory helper. */
  async linkEvaluationRun(
    experimentId: string,
    runId: string,
    status: ExperimentStatus,
    progress: number,
    completed: number,
    total: number
  ): Promise<void> {
    const db = getDb();
    const ex = await db.select().from(experiments).where(eq(experiments.id, experimentId)).limit(1);
    if (ex.length === 0) return;
    const now = new Date();
    const set: Record<string, unknown> = {
      evaluationRunId: runId,
      status,
      progress,
      completedTestCases: completed,
      totalTestCases: total,
      updatedAt: now,
    };
    if (status === "completed" && !ex[0].completedAt) set.completedAt = now;
    if (status === "running" && !ex[0].startedAt) set.startedAt = now;
    await db.update(experiments).set(set).where(eq(experiments.id, experimentId));
  },
};
