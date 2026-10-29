ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'do';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'shg';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "assigned_group_ids" text[];
