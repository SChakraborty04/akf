DO $$ BEGIN
    CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'super_admin';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'admin';
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "state" text DEFAULT 'Bihar' NOT NULL;
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "district" text DEFAULT 'Patna' NOT NULL;
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "block" text DEFAULT 'Phulwari Sharif' NOT NULL;
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "panchayat" text DEFAULT 'Rampur' NOT NULL;
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "village" text DEFAULT 'Rampur';
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "max_loan_amount" integer DEFAULT 50000 NOT NULL;
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "approval_required" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_max_loan_positive" CHECK ("groups"."max_loan_amount" > 0);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "group_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN IF NOT EXISTS "approval_status" "public"."approval_status" DEFAULT 'approved' NOT NULL;
--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN IF NOT EXISTS "approved_by" uuid;
--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "deposits" ADD CONSTRAINT "deposits_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deposits_approval_idx" ON "deposits" ("group_id", "approval_status");
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "approval_status" "public"."approval_status" DEFAULT 'approved' NOT NULL;
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "approved_by" uuid;
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "loans" ADD CONSTRAINT "loans_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loans_group_approval_idx" ON "loans" ("group_id", "approval_status");
--> statement-breakpoint
ALTER TABLE "repayments" ADD COLUMN IF NOT EXISTS "approval_status" "public"."approval_status" DEFAULT 'approved' NOT NULL;
--> statement-breakpoint
ALTER TABLE "repayments" ADD COLUMN IF NOT EXISTS "approved_by" uuid;
--> statement-breakpoint
ALTER TABLE "repayments" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "repayments" ADD CONSTRAINT "repayments_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_key_uq" ON "system_settings" ("key");
