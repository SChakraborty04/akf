ALTER TABLE "deposit_items" ADD COLUMN IF NOT EXISTS "approval_status" "public"."approval_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "deposit_items" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deposit_items" ADD COLUMN IF NOT EXISTS "approved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
