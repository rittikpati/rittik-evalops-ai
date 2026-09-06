import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  json,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

/** users â€” replaces the static in-memory store in backend/lib/auth/users.ts */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
    /** `${salt}:${hash}` scrypt string â€” never exposed to the client. Null for OAuth-only accounts. */
    passwordHash: text("password_hash"),
    /** OAuth provider identifier (e.g. "google", "github", "oidc") â€” null for password accounts. */
    provider: text("provider"),
    /** Provider-scoped account id returned by the OAuth/OIDC provider â€” null for password accounts. */
    providerAccountId: text("provider_account_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_provider_account_idx").on(t.provider, t.providerAccountId)]
);

/** datasets â€” mirrors the Dataset type from frontend/types/index.ts */
export const datasets = pgTable(
  "datasets",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    version: text("version").notNull().default("v1.0"),
    /** Source format â€” plain text in the DB so any canonical source format can be stored. */
    format: text("format").notNull().default("jsonl"),
    /** Display count of test cases (derived from test_cases for reads). */
    testCases: integer("test_cases").notNull().default(0),
    status: text("status", { enum: ["ready", "processing", "error", "uploading"] })
      .notNull()
      .default("ready"),
    size: text("size").notNull().default("0 KB"),
    tags: json("tags").$type<string[]>().notNull().default([]),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("datasets_owner_idx").on(t.ownerId)]
);

/** test_cases â€” mirrors the TestCase type from frontend/types/index.ts */
export const testCases = pgTable(
  "test_cases",
  {
    id: text("id").primaryKey(),
    datasetId: text("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    input: text("input").notNull(),
    expectedOutput: text("expected_output").notNull().default(""),
    context: text("context"),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull().default({}),
    index: integer("index").notNull().default(0),
  },
  (t) => [index("test_cases_dataset_idx").on(t.datasetId)]
);

/** experiments â€” mirrors ExperimentRecord + hidden run config from experimentRepository */
export const experiments = pgTable(
  "experiments",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    datasetId: text("dataset_id").notNull(),
    datasetName: text("dataset_name").notNull(),
    models: json("models").$type<string[]>().notNull().default([]),
    modelNames: json("model_names").$type<string[]>().notNull().default([]),
    status: text("status", {
      enum: ["draft", "running", "completed", "failed", "cancelled"],
    })
      .notNull()
      .default("draft"),
    progress: real("progress").notNull().default(0),
    totalTestCases: integer("total_test_cases").notNull().default(0),
    completedTestCases: integer("completed_test_cases").notNull().default(0),
    promptTemplate: text("prompt_template").notNull().default("Answer {{question}}"),
    systemPrompt: text("system_prompt"),
    temperature: real("temperature"),
    maxTokens: integer("max_tokens"),
    judgeModelId: text("judge_model_id"),
    evaluationRunId: text("evaluation_run_id"),
    metrics: json("metrics").$type<Record<string, number>>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("experiments_owner_idx").on(t.ownerId)]
);

/** runs â€” mirrors the EvaluationRun record stored by runsRepository */
export const runs = pgTable(
  "runs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    experimentId: text("experiment_id").notNull(),
    datasetId: text("dataset_id").notNull(),
    datasetName: text("dataset_name").notNull(),
    mode: text("mode", { enum: ["mock", "openrouter"] }).notNull().default("mock"),
    modelIds: json("model_ids").$type<string[]>().notNull().default([]),
    modelNames: json("model_names").$type<string[]>().notNull().default([]),
    promptTemplate: text("prompt_template").notNull(),
    systemPrompt: text("system_prompt"),
    temperature: real("temperature"),
    maxTokens: integer("max_tokens"),
    judgeModelId: text("judge_model_id").notNull().default("openai/gpt-4o-mini"),
    results: json("results")
      .$type<
        Array<{
          model: string;
          testCaseId: string;
          input: string;
          output: string;
          expectedOutput: string;
          status: "success" | "error";
          latency: number;
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
          estimatedCost: number | null;
          error?: string;
          scores?: Record<string, number>;
        }>
      >()
      .notNull()
      .default([]),
    aggregated: json("aggregated")
      .$type<Array<{ modelId: string; avgAccuracy: number; totalCost: number; successRate: number }>>()
      .notNull()
      .default([]),
    errors: json("errors")
      .$type<Array<{ modelId: string; testCaseId: string; message: string }>>()
      .notNull()
      .default([]),
    status: text("status", {
      enum: ["running", "completed", "failed", "partial"],
    })
      .notNull()
      .default("running"),
    total: integer("total").notNull().default(0),
    successful: integer("successful").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("runs_owner_idx").on(t.ownerId), index("runs_experiment_idx").on(t.experimentId)]
);

/** model_toggles â€” per-user enabled state for models in the registry (backend/lib/ai/models.ts) */
export const modelToggles = pgTable(
  "model_toggles",
  {
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    modelId: text("model_id").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.ownerId, t.modelId] }),
    index("model_toggles_owner_idx").on(t.ownerId),
  ]
);

/** custom_models â€” user-added models merged into the per-owner model list */
export const customModels = pgTable(
  "custom_models",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** OpenRouter-compatible id, e.g. "openai/gpt-5" (derived from provider + slug). */
    modelId: text("model_id").notNull(),
    /** Short id used by the experiment selection UI, e.g. "gpt-5". */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    provider: text("provider").notNull(),
    version: text("version").notNull().default("v1.0"),
    contextLength: integer("context_length").notNull().default(128000),
    maxOutputTokens: integer("max_output_tokens").notNull().default(8192),
    /** USD per 1M prompt tokens. */
    pricingPrompt: real("pricing_prompt").notNull().default(0),
    /** USD per 1M completion tokens. */
    pricingCompletion: real("pricing_completion").notNull().default(0),
    capabilities: json("capabilities").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("active"),
    description: text("description"),
    /** OpenRouter endpoint used at inference time. Defaults to modelId. */
    openRouterId: text("open_router_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("custom_models_owner_idx").on(t.ownerId),
    uniqueIndex("custom_models_owner_model_id_idx").on(t.ownerId, t.modelId),
    uniqueIndex("custom_models_owner_slug_idx").on(t.ownerId, t.slug),
  ]
);

/** prompts â€” reusable prompt templates (system + user) scoped to a user/workspace */
export const prompts = pgTable(
  "prompts",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    systemPrompt: text("system_prompt"),
    userPrompt: text("user_prompt").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("prompts_owner_idx").on(t.ownerId)]
);

/** Convenience re-export of all tables for migration/seed imports. */
export const schema = { users, datasets, testCases, experiments, runs, modelToggles, customModels, prompts };

