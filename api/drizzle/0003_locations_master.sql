CREATE TABLE IF NOT EXISTS "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"district" text NOT NULL,
	"block" text NOT NULL,
	"panchayat" text NOT NULL,
	"village" text NOT NULL,
	"pincode" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "locations_state_district_idx" ON "locations" ("state", "district");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "locations_block_panchayat_idx" ON "locations" ("block", "panchayat");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "locations_hierarchy_unique_idx" ON "locations" ("state", "district", "block", "panchayat", "village");
