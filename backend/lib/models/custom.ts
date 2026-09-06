import { and, desc, eq, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { customModels } from "@/lib/db/schema";
import { modelRegistry, type ModelCapability, type ModelConfig } from "@/lib/ai/models";

export interface NewCustomModelInput {
  name: string;
  provider: string;
  description?: string;
  version?: string;
  contextLength?: number;
  maxOutputTokens?: number;
  pricingPrompt?: number;
  pricingCompletion?: number;
  capabilities?: string[];
  openRouterId?: string;
}

export type CustomModelRow = typeof customModels.$inferSelect;

/** Thrown for registry or per-owner duplicate collisions. */
export class DuplicateModelError extends Error {
  code = "DUPLICATE_MODEL";
  constructor(message: string) {
    super(message);
    this.name = "DuplicateModelError";
  }
}

/** "GPT-5 Turbo" -> "gpt-5-turbo" */
export function slugifyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "model";
}

/** Converts a stored row into the ModelConfig shape the rest of the app expects. */
export function customModelToConfig(row: CustomModelRow): ModelConfig {
  return {
    id: row.modelId,
    slug: row.slug,
    provider: row.provider as ModelConfig["provider"],
    name: row.name,
    displayName: row.name,
    version: row.version,
    contextLength: row.contextLength,
    maxOutputTokens: row.maxOutputTokens,
    pricing: {
      prompt: row.pricingPrompt,
      completion: row.pricingCompletion,
      currency: "USD",
    },
    capabilities: row.capabilities as ModelCapability[],
    status: row.status as ModelConfig["status"],
    description: row.description ?? undefined,
    openRouterId: row.openRouterId,
    releasedAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : undefined,
  };
}

export const customModelRepository = {
  async getCustomModels(ownerId: string): Promise<CustomModelRow[]> {
    const db = getDb();
    return db
      .select()
      .from(customModels)
      .where(eq(customModels.ownerId, ownerId))
      .orderBy(desc(customModels.createdAt));
  },

  async createModel(ownerId: string, input: NewCustomModelInput): Promise<CustomModelRow> {
    const name = input.name.trim();
    const provider = input.provider.trim().toLowerCase();
    const slug = slugifyName(name);
    const modelId = `${provider}/${slug}`;

    // Built-in registry collision â€” these ids are global, not per-user.
    const registryHit = modelRegistry.find((m) => m.id === modelId || m.slug === slug);
    if (registryHit) {
      throw new DuplicateModelError(`"${name}" already exists as a built-in model (${registryHit.id}).`);
    }

    const db = getDb();
    const existing = await db
      .select({ id: customModels.id })
      .from(customModels)
      .where(
        and(
          eq(customModels.ownerId, ownerId),
          or(eq(customModels.modelId, modelId), eq(customModels.slug, slug))
        )
      )
      .limit(1);
    if (existing.length > 0) {
      throw new DuplicateModelError(`"${name}" is already in your model list.`);
    }

    const inserted = await db
      .insert(customModels)
      .values({
        id: `mod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ownerId,
        modelId,
        slug,
        name,
        provider,
        version: input.version?.trim() || "v1.0",
        contextLength: input.contextLength ?? 128000,
        maxOutputTokens: input.maxOutputTokens ?? 8192,
        pricingPrompt: input.pricingPrompt ?? 0,
        pricingCompletion: input.pricingCompletion ?? 0,
        capabilities: input.capabilities ?? ["text"],
        status: "active",
        description: input.description?.trim() || null,
        openRouterId: input.openRouterId?.trim() || modelId,
      })
      .returning();
    return inserted[0];
  },

  async deleteModel(ownerId: string, modelIdOrSlug: string): Promise<boolean> {
    const db = getDb();
    const rows = await db
      .delete(customModels)
      .where(
        and(
          eq(customModels.ownerId, ownerId),
          or(eq(customModels.modelId, modelIdOrSlug), eq(customModels.slug, modelIdOrSlug))
        )
      )
      .returning();
    return rows.length > 0;
  },
};

/** Resolves a model id/slug against the built-in registry first, then the user's custom models. */
export async function resolveUserModel(ownerId: string, id: string): Promise<ModelConfig | undefined> {
  const registryHit = modelRegistry.find((m) => m.id === id || m.slug === id);
  if (registryHit) return registryHit;
  const rows = await customModelRepository.getCustomModels(ownerId);
  const row = rows.find((c) => c.modelId === id || c.slug === id);
  return row ? customModelToConfig(row) : undefined;
}

/** Resolves a list of model ids/slugs, skipping any that can't be resolved. */
export async function resolveUserModels(ownerId: string, ids: string[]): Promise<ModelConfig[]> {
  const resolved: ModelConfig[] = [];
  for (const id of ids) {
    const m = await resolveUserModel(ownerId, id);
    if (m) resolved.push(m);
  }
  return resolved;
}