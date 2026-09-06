ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "provider_account_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_account_idx" ON "users" USING btree ("provider","provider_account_id");