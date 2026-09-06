CREATE TABLE "custom_models" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"model_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"version" text DEFAULT 'v1.0' NOT NULL,
	"context_length" integer DEFAULT 128000 NOT NULL,
	"max_output_tokens" integer DEFAULT 8192 NOT NULL,
	"pricing_prompt" real DEFAULT 0 NOT NULL,
	"pricing_completion" real DEFAULT 0 NOT NULL,
	"capabilities" json DEFAULT '[]'::json NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"description" text,
	"open_router_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_models" ADD CONSTRAINT "custom_models_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_models_owner_idx" ON "custom_models" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_models_owner_model_id_idx" ON "custom_models" USING btree ("owner_id","model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_models_owner_slug_idx" ON "custom_models" USING btree ("owner_id","slug");