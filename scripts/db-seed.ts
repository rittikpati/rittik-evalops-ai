/**
 * RittikEvalOpsAI â€” Seed script.
 *
 * Idempotently seeds the datasets, test cases and experiments into
 * Supabase, faithfully reproducing the previous in-memory seed data (mock ids,
 * sizes, statuses, timestamps and derived test cases) so the UI matches.
 *
 * Run with:  npx tsx --env-file=.env.local scripts/db-seed.ts
 * DATABASE_URL is loaded into process.env by --env-file; never printed.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../backend/lib/db";
import { datasets, testCases, experiments } from "../backend/lib/db/schema";
import { mockDatasets, mockExperiments } from "../frontend/data/mockData";
import type { TestCase } from "../frontend/types";

const SAMPLES: Array<{ input: string; expected: string; context?: string }> = [
  { input: "What is 2 + 2?", expected: "4", context: "Math" },
  { input: "What is the capital of France?", expected: "Paris", context: "Geography" },
  { input: "What planet do humans live on?", expected: "Earth", context: "Astronomy" },
  { input: "Who wrote '1984'?", expected: "George Orwell", context: "Literature" },
  { input: "Explain photosynthesis.", expected: "Photosynthesis converts light into chemical energy.", context: "Biology" },
  { input: "What is the largest ocean?", expected: "Pacific Ocean", context: "Geography" },
];

/** Mirrors the original in-memory seedTestCases(), preserving generated ids. */
function buildSeedCases(datasetId: string, datasetName: string, count: number): TestCase[] {
  const n = Math.min(count, 6);
  return Array.from({ length: n }, (_, i) => {
    const s = SAMPLES[i % SAMPLES.length];
    return {
      id: `${datasetId}-tc-${String(i + 1).padStart(3, "0")}`,
      datasetId,
      input: s.input,
      expectedOutput: s.expected,
      context: s.context ? `${s.context} â€” ${datasetName}` : undefined,
      metadata: { source: datasetName, index: i },
      index: i,
    };
  });
}

async function seed() {
  const db = getDb();

  let datasetsInserted = 0;
  let casesInserted = 0;
  for (const d of mockDatasets) {
    const existing = await db.select().from(datasets).where(eq(datasets.id, d.id)).limit(1);
    const caseList = d.testCases ? buildSeedCases(d.id, d.name, d.testCases) : [];
    if (existing.length === 0) {
      await db.insert(datasets).values({
        id: d.id,
        ownerId: d.ownerId,
        name: d.name,
        description: d.description ?? null,
        version: d.version,
        format: d.format,
        testCases: caseList.length,
        status: d.status,
        size: d.size,
        tags: d.tags ?? [],
        lastUpdated: new Date(d.lastUpdated),
        createdAt: new Date(d.createdAt ?? d.lastUpdated),
      });
      datasetsInserted++;
    }
    for (const tc of caseList) {
      const exists = await db.select().from(testCases).where(eq(testCases.id, tc.id)).limit(1);
      if (exists.length === 0) {
        await db.insert(testCases).values({
          id: tc.id,
          datasetId: tc.datasetId,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          context: tc.context ?? null,
          metadata: tc.metadata ?? {},
          index: tc.index,
        });
        casesInserted++;
      }
    }
  }

  let experimentsInserted = 0;
  for (const e of mockExperiments) {
    const existing = await db.select().from(experiments).where(eq(experiments.id, e.id)).limit(1);
    if (existing.length === 0) {
      await db.insert(experiments).values({
        id: e.id,
        ownerId: e.ownerId,
        name: e.name,
        description: e.description ?? null,
        datasetId: e.datasetId,
        datasetName: e.datasetName,
        models: e.models,
        modelNames: e.models,
        status: e.status,
        progress: e.progress,
        totalTestCases: e.totalTestCases,
        completedTestCases: e.completedTestCases,
        promptTemplate: "Answer {{question}}",
        systemPrompt: "You are a helpful assistant.",
        temperature: 0.7,
        maxTokens: 512,
        judgeModelId: "openai/gpt-4o-mini",
        metrics: (e.metrics as unknown as Record<string, number>) ?? null,
        startedAt: e.startedAt ? new Date(e.startedAt) : null,
        completedAt: e.completedAt ? new Date(e.completedAt) : null,
        createdAt: new Date(e.createdAt),
        updatedAt: new Date(e.updatedAt),
      });
      experimentsInserted++;
    }
  }

  console.log(
    `SEED_OK datasets=${datasetsInserted} test_cases=${casesInserted} experiments=${experimentsInserted}`
  );
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("SEED_FAILED", err?.message || err);
    process.exit(1);
  });

