CREATE TABLE "datasets" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"version" text DEFAULT 'v1.0' NOT NULL,
	"format" text DEFAULT 'jsonl' NOT NULL,
	"test_cases" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"size" text DEFAULT '0 KB' NOT NULL,
	"tags" json DEFAULT '[]'::json NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"dataset_id" text NOT NULL,
	"dataset_name" text NOT NULL,
	"models" json DEFAULT '[]'::json NOT NULL,
	"model_names" json DEFAULT '[]'::json NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"progress" real DEFAULT 0 NOT NULL,
	"total_test_cases" integer DEFAULT 0 NOT NULL,
	"completed_test_cases" integer DEFAULT 0 NOT NULL,
	"prompt_template" text DEFAULT 'Answer {{question}}' NOT NULL,
	"system_prompt" text,
	"temperature" real,
	"max_tokens" integer,
	"judge_model_id" text,
	"evaluation_run_id" text,
	"metrics" json,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"experiment_id" text NOT NULL,
	"dataset_id" text NOT NULL,
	"dataset_name" text NOT NULL,
	"mode" text DEFAULT 'mock' NOT NULL,
	"model_ids" json DEFAULT '[]'::json NOT NULL,
	"model_names" json DEFAULT '[]'::json NOT NULL,
	"prompt_template" text NOT NULL,
	"system_prompt" text,
	"temperature" real,
	"max_tokens" integer,
	"judge_model_id" text DEFAULT 'openai/gpt-4o-mini' NOT NULL,
	"results" json DEFAULT '[]'::json NOT NULL,
	"aggregated" json DEFAULT '[]'::json NOT NULL,
	"errors" json DEFAULT '[]'::json NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"successful" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"dataset_id" text NOT NULL,
	"input" text NOT NULL,
	"expected_output" text DEFAULT '' NOT NULL,
	"context" text,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "datasets_owner_idx" ON "datasets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "experiments_owner_idx" ON "experiments" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "runs_owner_idx" ON "runs" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "runs_experiment_idx" ON "runs" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "test_cases_dataset_idx" ON "test_cases" USING btree ("dataset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");