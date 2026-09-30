CREATE TYPE "public"."account_status" AS ENUM('UNFUNDED', 'FUNDED', 'RESTRICTED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."authorization_rail" AS ENUM('ALTANA_SESSION', 'ERC8183_ESCROW', 'AACP_PROGRAM', 'X402_PAYMENT');--> statement-breakpoint
CREATE TYPE "public"."authorization_status" AS ENUM('PENDING', 'GRANTED', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('rebalancing', 'grid_trading', 'yield_optimization', 'health_factor_monitoring');--> statement-breakpoint
CREATE TYPE "public"."credential_net" AS ENUM('bsc', 'tbsc');--> statement-breakpoint
CREATE TYPE "public"."credential_status" AS ENUM('PENDING', 'ACTIVE', 'ROTATING', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."credential_tier" AS ENUM('dlg', 'svc');--> statement-breakpoint
CREATE TYPE "public"."escrow_variant" AS ENUM('PLAIN', 'AACP_PROGRAM');--> statement-breakpoint
CREATE TYPE "public"."job_execution_status" AS ENUM('CONFIGURED', 'AUTHORIZED', 'ACTIVE', 'RUNNING', 'PAUSED', 'DEGRADED', 'ATTENTION_REQUIRED', 'EXPIRED', 'REVOKED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."job_settlement_status" AS ENUM('HELD', 'RELEASED', 'REFUNDED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('DISCOVERED', 'CLAIMED', 'OWNERSHIP_VERIFIED', 'ENDPOINT_VERIFIED', 'LIVE', 'DEGRADED', 'SUSPENDED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."proof_type" AS ENUM('IDENTITY', 'CAPABILITY', 'EXECUTION', 'OUTCOME', 'AUTHORITY', 'SETTLEMENT', 'RELIABILITY');--> statement-breakpoint
CREATE TYPE "public"."trust_tier" AS ENUM('Low', 'Medium', 'High');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"status" "account_status" DEFAULT 'UNFUNDED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_wallet" varchar(42) NOT NULL,
	"buyer_minimum_trust_tier" "trust_tier" NOT NULL,
	"status" "authorization_status" DEFAULT 'PENDING' NOT NULL,
	"rail" "authorization_rail" NOT NULL,
	"scope" jsonb NOT NULL,
	"escrow_variant" "escrow_variant",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"device_pub_key" text NOT NULL,
	"status" "credential_status" DEFAULT 'PENDING' NOT NULL,
	"tier" "credential_tier" NOT NULL,
	"net" "credential_net" NOT NULL,
	"kid" varchar(22) NOT NULL,
	"secret_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"evidence_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"agent_id" text NOT NULL,
	"version_hash" text NOT NULL,
	"authorization_id" uuid,
	"action_type" text NOT NULL,
	"tx_hash" text,
	"proof_type" "proof_type" NOT NULL,
	"evidence_level" smallint NOT NULL,
	"source" text NOT NULL,
	"verification_ref" jsonb,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_level_range" CHECK ("evidence"."evidence_level" >= 0 AND "evidence"."evidence_level" <= 6)
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"authorization_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"execution_status" "job_execution_status" DEFAULT 'CONFIGURED' NOT NULL,
	"settlement_status" "job_settlement_status" DEFAULT 'HELD' NOT NULL,
	"fee_bps" integer,
	"fee_charged_amount" numeric,
	"measured_performance_fee" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_fee_bps_range" CHECK ("jobs"."fee_bps" IS NULL OR ("jobs"."fee_bps" >= 0 AND "jobs"."fee_bps" <= 10000))
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"category" "category" NOT NULL,
	"status" "listing_status" DEFAULT 'DISCOVERED' NOT NULL,
	"trust_tier" "trust_tier",
	"owner_wallet" varchar(42) NOT NULL,
	"erc8004_chain_id" integer,
	"erc8004_token_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "authorizations" ADD CONSTRAINT "authorizations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_authorization_id_authorizations_id_fk" FOREIGN KEY ("authorization_id") REFERENCES "public"."authorizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_wallet_address_idx" ON "accounts" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "authorizations_listing_id_idx" ON "authorizations" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "authorizations_buyer_wallet_idx" ON "authorizations" USING btree ("buyer_wallet");--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_kid_idx" ON "credentials" USING btree ("kid");--> statement-breakpoint
CREATE INDEX "credentials_account_id_idx" ON "credentials" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "evidence_agent_id_idx" ON "evidence" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "evidence_job_id_idx" ON "evidence" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "evidence_authorization_id_idx" ON "evidence" USING btree ("authorization_id");--> statement-breakpoint
CREATE INDEX "jobs_authorization_id_idx" ON "jobs" USING btree ("authorization_id");--> statement-breakpoint
CREATE INDEX "jobs_listing_id_idx" ON "jobs" USING btree ("listing_id");