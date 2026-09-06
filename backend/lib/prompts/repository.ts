import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { prompts } from "@/lib/db/schema";
import type { Prompt } from "@/types";

type PromptRow = typeof prompts.$inferSelect;

function iso(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value instanceof Date ? value.toISOString() : value;
}

function toPrompt(row: PromptRow): Prompt {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    systemPrompt: row.systemPrompt ?? undefined,
    userPrompt: row.userPrompt,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export const promptsRepository = {
  async getPrompts(ownerId?: string): Promise<Prompt[]> {
    const db = getDb();
    const rows =
      ownerId !== undefined
        ? await db.select().from(prompts).where(eq(prompts.ownerId, ownerId)).orderBy(desc(prompts.updatedAt))
        : await db.select().from(prompts).orderBy(desc(prompts.updatedAt));
    return rows.map(toPrompt);
  },

  async getPrompt(id: string, ownerId?: string): Promise<Prompt | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(prompts)
      .where(ownerId !== undefined ? and(eq(prompts.id, id), eq(prompts.ownerId, ownerId)) : eq(prompts.id, id))
      .limit(1);
    return rows.length > 0 ? toPrompt(rows[0]) : undefined;
  },

  async createPrompt(
    input: Pick<Prompt, "ownerId" | "name" | "userPrompt"> &
      Partial<Pick<Prompt, "id" | "systemPrompt">>
  ): Promise<Prompt> {
    const db = getDb();
    const now = new Date();
    const inserted = await db
      .insert(prompts)
      .values({
        id: input.id ?? `prm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ownerId: input.ownerId,
        name: input.name.trim(),
        systemPrompt: input.systemPrompt?.trim() || null,
        userPrompt: input.userPrompt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toPrompt(inserted[0]);
  },

  async updatePrompt(
    id: string,
    ownerId: string,
    patch: Partial<Pick<Prompt, "name" | "systemPrompt" | "userPrompt">>
  ): Promise<Prompt | undefined> {
    const db = getDb();
    const existing = await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.id, id), eq(prompts.ownerId, ownerId)))
      .limit(1);
    if (existing.length === 0) return undefined;

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.systemPrompt !== undefined) set.systemPrompt = patch.systemPrompt?.trim() || null;
    if (patch.userPrompt !== undefined) set.userPrompt = patch.userPrompt;

    const [row] = await db.update(prompts).set(set).where(eq(prompts.id, id)).returning();
    return toPrompt(row);
  },

  async deletePrompt(id: string, ownerId: string): Promise<boolean> {
    const db = getDb();
    const rows = await db
      .delete(prompts)
      .where(and(eq(prompts.id, id), eq(prompts.ownerId, ownerId)))
      .returning();
    return rows.length > 0;
  },
};