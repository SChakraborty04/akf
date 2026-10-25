CREATE TYPE "public"."language_code" AS ENUM('en', 'hi');--> statement-breakpoint
CREATE TYPE "public"."ledger_type" AS ENUM('deposit', 'loan', 'repayment');--> statement-breakpoint
CREATE TYPE "public"."loan_status" AS ENUM('active', 'paid');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('operator', 'viewer');--> statement-breakpoint
CREATE TABLE "cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"cycle_no" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"duration_weeks" integer NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cycles_dates_ordered" CHECK ("cycles"."end_date" >= "cycles"."start_date")
);
--> statement-breakpoint
CREATE TABLE "deposit_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deposit_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"stamps" integer NOT NULL,
	"amount" integer NOT NULL,
	CONSTRAINT "deposit_items_positive" CHECK ("deposit_items"."stamps" > 0 AND "deposit_items"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"cycle_id" uuid,
	"client_id" uuid,
	"date" date NOT NULL,
	"note" text,
	"total_stamps" integer NOT NULL,
	"stamp_value" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposits_totals_positive" CHECK ("deposits"."total_stamps" > 0 AND "deposits"."total_amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"hindi_name" text,
	"address" text,
	"stamp_value" integer DEFAULT 50 NOT NULL,
	"max_stamps_per_member" integer DEFAULT 5 NOT NULL,
	"monthly_interest_rate" numeric(6, 4) DEFAULT '0.0200' NOT NULL,
	"repayment_stamp_rate" numeric(6, 4) DEFAULT '0.0200' NOT NULL,
	"meeting_day" text,
	"loan_seq" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_stamp_value_positive" CHECK ("groups"."stamp_value" > 0),
	CONSTRAINT "groups_max_stamps_positive" CHECK ("groups"."max_stamps_per_member" > 0),
	CONSTRAINT "groups_rates_non_negative" CHECK ("groups"."monthly_interest_rate" >= 0 AND "groups"."repayment_stamp_rate" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"type" "ledger_type" NOT NULL,
	"amount" integer NOT NULL,
	"date" date NOT NULL,
	"member_id" uuid,
	"deposit_id" uuid,
	"loan_id" uuid,
	"repayment_id" uuid,
	"stamps" integer,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_amount_positive" CHECK ("ledger_entries"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "loan_shapes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"value" integer NOT NULL,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loan_shapes_value_positive" CHECK ("loan_shapes"."value" > 0)
);
--> statement-breakpoint
CREATE TABLE "loan_stamps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"shape_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "loan_stamps_value_positive" CHECK ("loan_stamps"."value" > 0)
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"cycle_id" uuid,
	"loan_no" integer NOT NULL,
	"client_id" uuid,
	"principal_amount" integer NOT NULL,
	"date" date NOT NULL,
	"monthly_interest_rate" numeric(6, 4) NOT NULL,
	"status" "loan_status" DEFAULT 'active' NOT NULL,
	"closed_on" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loans_principal_positive" CHECK ("loans"."principal_amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"hh_no" text NOT NULL,
	"name" text NOT NULL,
	"husband_name" text,
	"id_no" text,
	"age" integer,
	"caste" text,
	"mobile_no" text,
	"education" text,
	"agri_land_acres" numeric(7, 2),
	"irrigated_land_acres" numeric(7, 2),
	"goat_count" integer DEFAULT 0 NOT NULL,
	"animal_count" integer DEFAULT 0 NOT NULL,
	"family_size" integer,
	"income_source" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repayment_stamps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repayment_id" uuid NOT NULL,
	"shape_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "repayment_stamps_value_positive" CHECK ("repayment_stamps"."value" > 0)
);
--> statement-breakpoint
CREATE TABLE "repayments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"loan_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"cycle_id" uuid,
	"client_id" uuid,
	"date" date NOT NULL,
	"amount_paid" integer NOT NULL,
	"interest_deducted" integer NOT NULL,
	"principal_deducted" integer NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repayments_amount_positive" CHECK ("repayments"."amount_paid" > 0),
	CONSTRAINT "repayments_split_non_negative" CHECK ("repayments"."interest_deducted" >= 0 AND "repayments"."principal_deducted" >= 0),
	CONSTRAINT "repayments_split_matches_amount" CHECK ("repayments"."interest_deducted" + "repayments"."principal_deducted" = "repayments"."amount_paid")
);
--> statement-breakpoint
-- The scaffold `users` table (name/email) was a connectivity test with no real data.
-- It is replaced by the auth accounts table below.
DROP TABLE "users" CASCADE;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "user_role" DEFAULT 'operator' NOT NULL,
	"language" "language_code" DEFAULT 'en' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_items" ADD CONSTRAINT "deposit_items_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_items" ADD CONSTRAINT "deposit_items_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_repayment_id_repayments_id_fk" FOREIGN KEY ("repayment_id") REFERENCES "public"."repayments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_shapes" ADD CONSTRAINT "loan_shapes_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_stamps" ADD CONSTRAINT "loan_stamps_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_stamps" ADD CONSTRAINT "loan_stamps_shape_id_loan_shapes_id_fk" FOREIGN KEY ("shape_id") REFERENCES "public"."loan_shapes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repayment_stamps" ADD CONSTRAINT "repayment_stamps_repayment_id_repayments_id_fk" FOREIGN KEY ("repayment_id") REFERENCES "public"."repayments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repayment_stamps" ADD CONSTRAINT "repayment_stamps_shape_id_loan_shapes_id_fk" FOREIGN KEY ("shape_id") REFERENCES "public"."loan_shapes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repayments" ADD CONSTRAINT "repayments_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repayments" ADD CONSTRAINT "repayments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repayments" ADD CONSTRAINT "repayments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repayments" ADD CONSTRAINT "repayments_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repayments" ADD CONSTRAINT "repayments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cycles_group_cycle_no_uq" ON "cycles" USING btree ("group_id","cycle_no");--> statement-breakpoint
CREATE UNIQUE INDEX "cycles_one_current_per_group_uq" ON "cycles" USING btree ("group_id") WHERE "cycles"."is_current";--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_items_deposit_member_uq" ON "deposit_items" USING btree ("deposit_id","member_id");--> statement-breakpoint
CREATE INDEX "deposit_items_member_idx" ON "deposit_items" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deposits_group_client_uq" ON "deposits" USING btree ("group_id","client_id");--> statement-breakpoint
CREATE INDEX "deposits_group_date_idx" ON "deposits" USING btree ("group_id","date");--> statement-breakpoint
CREATE INDEX "ledger_group_date_idx" ON "ledger_entries" USING btree ("group_id","date","created_at");--> statement-breakpoint
CREATE INDEX "ledger_group_member_idx" ON "ledger_entries" USING btree ("group_id","member_id");--> statement-breakpoint
CREATE INDEX "ledger_deposit_idx" ON "ledger_entries" USING btree ("deposit_id");--> statement-breakpoint
CREATE INDEX "ledger_loan_idx" ON "ledger_entries" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "ledger_repayment_idx" ON "ledger_entries" USING btree ("repayment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loan_shapes_group_code_uq" ON "loan_shapes" USING btree ("group_id","code");--> statement-breakpoint
CREATE INDEX "loan_stamps_loan_idx" ON "loan_stamps" USING btree ("loan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loans_group_loan_no_uq" ON "loans" USING btree ("group_id","loan_no");--> statement-breakpoint
CREATE UNIQUE INDEX "loans_group_client_uq" ON "loans" USING btree ("group_id","client_id");--> statement-breakpoint
CREATE INDEX "loans_group_member_idx" ON "loans" USING btree ("group_id","member_id");--> statement-breakpoint
CREATE INDEX "loans_group_status_idx" ON "loans" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "loans_group_date_idx" ON "loans" USING btree ("group_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "members_group_hh_no_uq" ON "members" USING btree ("group_id","hh_no");--> statement-breakpoint
CREATE INDEX "members_group_active_idx" ON "members" USING btree ("group_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_hash_uq" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "repayment_stamps_repayment_idx" ON "repayment_stamps" USING btree ("repayment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repayments_group_client_uq" ON "repayments" USING btree ("group_id","client_id");--> statement-breakpoint
CREATE INDEX "repayments_loan_idx" ON "repayments" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "repayments_group_date_idx" ON "repayments" USING btree ("group_id","date");--> statement-breakpoint
CREATE INDEX "repayments_group_member_idx" ON "repayments" USING btree ("group_id","member_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_group_idx" ON "users" USING btree ("group_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_normalized" CHECK ("users"."username" = lower(btrim("users"."username")));