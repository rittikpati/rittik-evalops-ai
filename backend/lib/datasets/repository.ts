import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { datasets, testCases } from "@/lib/db/schema";
import type { Dataset, TestCase } from "@/types";

type DatasetRow = typeof datasets.$inferSelect;
type TestCaseRow = typeof testCases.$inferSelect;

function iso(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : value;
}

function toDataset(row: DatasetRow, cases: TestCase[] = []): Dataset {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    version: row.version,
    format: row.format as Dataset["format"],
    testCases: row.testCases,
    cases,
    status: row.status,
    size: row.size,
    lastUpdated: iso(row.lastUpdated),
    createdAt: iso(row.createdAt),
    description: row.description ?? undefined,
    tags: row.tags,
  };
}

function toTestCase(row: TestCaseRow): TestCase {
  return {
    id: row.id,
    datasetId: row.datasetId,
    input: row.input,
    expectedOutput: row.expectedOutput,
    context: row.context ?? undefined,
    metadata: row.metadata,
    index: row.index,
  };
}

/** Loads the test cases for a set of dataset ids, grouped by datasetId. */
async function casesByDataset(datasetIds: string[]): Promise<Map<string, TestCase[]>> {
  const db = getDb();
  const map = new Map<string, TestCase[]>();
  if (datasetIds.length === 0) return map;
  const rows = await db
    .select()
    .from(testCases)
    .where(inArray(testCases.datasetId, datasetIds));
  for (const r of rows) {
    const list = map.get(r.datasetId) ?? [];
    list.push(toTestCase(r));
    map.set(r.datasetId, list);
  }
  return map;
}

export const datasetRepository = {
  async getDatasets(ownerId?: string): Promise<Dataset[]> {
    const db = getDb();
    const where = ownerId !== undefined ? eq(datasets.ownerId, ownerId) : undefined;
    const rows = where
      ? await db.select().from(datasets).where(where).orderBy(desc(datasets.createdAt))
      : await db.select().from(datasets).orderBy(desc(datasets.createdAt));

    const grouped = await casesByDataset(rows.map((r) => r.id));
    return rows.map((r) => toDataset(r, grouped.get(r.id) ?? []));
  },

  async getDataset(id: string, ownerId?: string): Promise<Dataset | undefined> {
    const db = getDb();
    const row = await db
      .select()
      .from(datasets)
      .where(ownerId !== undefined ? and(eq(datasets.id, id), eq(datasets.ownerId, ownerId)) : eq(datasets.id, id))
      .limit(1);
    if (row.length === 0) return undefined;
    const cases = await db.select().from(testCases).where(eq(testCases.datasetId, id)).orderBy(asc(testCases.index));
    return toDataset(row[0], cases.map(toTestCase));
  },

  async createDataset(
    input: Pick<Dataset, "name" | "ownerId" | "description"> &
      Partial<Pick<Dataset, "format" | "tags" | "version">>
  ): Promise<Dataset> {
    const db = getDb();
    const id = `ds_${Date.now()}`;
    const now = new Date();
    const [row] = await db
      .insert(datasets)
      .values({
        id,
        ownerId: input.ownerId,
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
        version: input.version ?? "v1.0",
        format: (input.format as Dataset["format"]) || "jsonl",
        tags: input.tags ?? [],
        testCases: 0,
      })
      .returning();
    return toDataset(row, []);
  },

  async updateDataset(
    id: string,
    ownerId: string,
    patch: Partial<Pick<Dataset, "name" | "description" | "tags">>
  ): Promise<Dataset | undefined> {
    const db = getDb();
    const existing = await db
      .select()
      .from(datasets)
      .where(and(eq(datasets.id, id), eq(datasets.ownerId, ownerId)))
      .limit(1);
    if (existing.length === 0) return undefined;

    const [row] = await db
      .update(datasets)
      .set({
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.description !== undefined ? { description: patch.description?.trim() ?? null } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        lastUpdated: new Date(),
      })
      .where(eq(datasets.id, id))
      .returning();

    const cases = await db.select().from(testCases).where(eq(testCases.datasetId, id)).orderBy(asc(testCases.index));
    return toDataset(row, cases.map(toTestCase));
  },

  async deleteDataset(id: string, ownerId: string): Promise<boolean> {
    const db = getDb();
    const rows = await db
      .delete(datasets)
      .where(and(eq(datasets.id, id), eq(datasets.ownerId, ownerId)))
      .returning();
    return rows.length > 0;
  },

  async getTestCases(datasetId: string, ownerId?: string): Promise<TestCase[]> {
    const db = getDb();
    const ds = await this.getDataset(datasetId, ownerId);
    if (!ds) return [];
    const rows = await db.select().from(testCases).where(eq(testCases.datasetId, datasetId)).orderBy(asc(testCases.index));
    return rows.map(toTestCase);
  },

  async createTestCase(
    datasetId: string,
    ownerId: string,
    input: Pick<TestCase, "input"> & Partial<Pick<TestCase, "expectedOutput" | "context" | "metadata">>
  ): Promise<TestCase | undefined> {
    const db = getDb();
    const ds = await this.getDataset(datasetId, ownerId);
    if (!ds) return undefined;
    const trimmed = input.input.trim();
    if (!trimmed) return undefined;

    const index = ds.cases?.length ?? 0;
    const id = `${datasetId}-tc-${String(index + 1).padStart(3, "0")}_${Date.now().toString(36)}`;
    const [row] = await db
      .insert(testCases)
      .values({
        id,
        datasetId,
        input: trimmed,
        expectedOutput: input.expectedOutput?.trim() ?? "",
        context: input.context?.trim() || null,
        metadata: input.metadata || {},
        index,
      })
      .returning();

    const count = index + 1;
    await db
      .update(datasets)
      .set({ testCases: count, size: `${(count * 0.52).toFixed(1)} KB`, lastUpdated: new Date() })
      .where(eq(datasets.id, datasetId));

    return toTestCase(row);
  },

  async updateTestCase(
    datasetId: string,
    ownerId: string,
    testCaseId: string,
    patch: Partial<Pick<TestCase, "input" | "expectedOutput" | "context">>
  ): Promise<TestCase | undefined> {
    const db = getDb();
    const ds = await this.getDataset(datasetId, ownerId);
    if (!ds) return undefined;

    const existing = await db
      .select()
      .from(testCases)
      .where(and(eq(testCases.id, testCaseId), eq(testCases.datasetId, datasetId)))
      .limit(1);
    if (existing.length === 0) return undefined;
    if (patch.input !== undefined && !patch.input.trim()) return undefined;

    const [row] = await db
      .update(testCases)
      .set({
        ...(patch.input !== undefined ? { input: patch.input.trim() } : {}),
        ...(patch.expectedOutput !== undefined ? { expectedOutput: patch.expectedOutput.trim() } : {}),
        ...(patch.context !== undefined ? { context: patch.context?.trim() || null } : {}),
      })
      .where(eq(testCases.id, testCaseId))
      .returning();

    await db.update(datasets).set({ lastUpdated: new Date() }).where(eq(datasets.id, datasetId));
    return toTestCase(row);
  },

  async deleteTestCase(datasetId: string, ownerId: string, testCaseId: string): Promise<boolean> {
    const db = getDb();
    const ds = await this.getDataset(datasetId, ownerId);
    if (!ds) return false;

    const deleted = await db
      .delete(testCases)
      .where(and(eq(testCases.id, testCaseId), eq(testCases.datasetId, datasetId)))
      .returning();
    if (deleted.length === 0) return false;

    const remaining = await db
      .select()
      .from(testCases)
      .where(eq(testCases.datasetId, datasetId))
      .orderBy(asc(testCases.index));
    // reindex
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].index !== i) {
        await db.update(testCases).set({ index: i }).where(eq(testCases.id, remaining[i].id));
      }
    }
    await db
      .update(datasets)
      .set({
        testCases: remaining.length,
        size: `${(remaining.length * 0.52).toFixed(1)} KB`,
        lastUpdated: new Date(),
      })
      .where(eq(datasets.id, datasetId));

    return true;
  },

  /** Creates a small deterministic dataset for pipeline testing. */
  async createTestDataset(ownerId: string): Promise<Dataset> {
    const ds = await this.createDataset({
      name: `Test Dataset ${new Date().toLocaleTimeString()}`,
      ownerId,
      description: "Small dataset for pipeline testing",
      format: "jsonl",
      tags: ["test"],
    });
    await this.createTestCase(ds.id, ownerId, { input: "What is 2 + 2?", expectedOutput: "4", context: "Math" });
    await this.createTestCase(ds.id, ownerId, { input: "What is the capital of France?", expectedOutput: "Paris", context: "Geography" });
    await this.createTestCase(ds.id, ownerId, { input: "What planet do humans live on?", expectedOutput: "Earth", context: "Astronomy" });
    return (await this.getDataset(ds.id, ownerId))!;
  },

  /** No-op reset (previously used by in-memory tests). */
  async _reset(): Promise<void> {
    // Data now persists in the database; there is nothing to reset in memory.
  },
};
