CREATE TABLE "model_toggles" (
	"owner_id" text NOT NULL,
	"model_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_toggles_owner_id_model_id_pk" PRIMARY KEY("owner_id","model_id")
);
--> statement-breakpoint
ALTER TABLE "model_toggles" ADD CONSTRAINT "model_toggles_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_toggles_owner_idx" ON "model_toggles" USING btree ("owner_id");