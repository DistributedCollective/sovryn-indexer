CREATE TABLE IF NOT EXISTS "pool_liquidity_changes" (
	"id" serial NOT NULL,
	"identifier" char(64) PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"pool_id" char(64),
	"position_id" char(64),
	"user" char(42) NOT NULL,
	"extra" jsonb DEFAULT '{}'::jsonb,
	"provider" varchar(256) NOT NULL,
	"type" varchar(256) NOT NULL,
	"token_id" char(64),
	"token_amount" varchar(256) DEFAULT '0' NOT NULL,
	"transaction_hash" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pool_positions" (
	"id" serial NOT NULL,
	"identifier" char(64) PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"pool_id" char(64),
	"user" char(42) NOT NULL,
	"extra" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingestion_sources" (
	"id" serial NOT NULL,
	"key" char(64) PRIMARY KEY NOT NULL,
	"tags" varchar(1024) DEFAULT '[]',
	"mode" varchar(32) DEFAULT 'backfill' NOT NULL,
	"high_water_mark" varchar(32) DEFAULT 'date' NOT NULL,
	"backfill_cursor" varchar(1024),
	"live_cursor" varchar(1024),
	"live_watermark" varchar(256),
	"last_synced_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial NOT NULL,
	"address" char(42) PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP TABLE "flags";--> statement-breakpoint
ALTER TABLE "legacy_amm__apy_blocks" DROP CONSTRAINT "legacy_amm__apy_blocks_chain_id_chains_id_fk";
--> statement-breakpoint
ALTER TABLE "legacy_amm__apy_days" DROP CONSTRAINT "legacy_amm__apy_days_chain_id_chains_id_fk";
--> statement-breakpoint
ALTER TABLE "legacy_amm__pools" DROP CONSTRAINT "legacy_amm__pools_chain_id_chains_id_fk";
--> statement-breakpoint
ALTER TABLE "legacy_tvls" DROP CONSTRAINT "legacy_tvls_chain_id_chains_id_fk";
--> statement-breakpoint
ALTER TABLE "tokens" DROP CONSTRAINT "tokens_chain_id_chains_id_fk";
--> statement-breakpoint
ALTER TABLE "prices_usd_daily" DROP CONSTRAINT "prices_usd_daily_token_id_tokens_id_fk";
--> statement-breakpoint
ALTER TABLE "prices_usd_hourly" DROP CONSTRAINT "prices_usd_hourly_token_id_tokens_id_fk";
--> statement-breakpoint
ALTER TABLE "prices_usd" DROP CONSTRAINT "prices_usd_token_id_tokens_id_fk";
--> statement-breakpoint
ALTER TABLE "pools" DROP CONSTRAINT "pools_chain_id_chains_id_fk";
--> statement-breakpoint
ALTER TABLE "chains" ADD COLUMN "stablecoin_identifier" char(64);--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "identifier" char(64);--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "processed" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "prices_usd_daily" ADD COLUMN "token_identifier" char(64);--> statement-breakpoint
ALTER TABLE "prices_usd_hourly" ADD COLUMN "token_identifier" char(64);--> statement-breakpoint
ALTER TABLE "prices_usd" ADD COLUMN "token_identifier" char(64);--> statement-breakpoint
ALTER TABLE "pools" ADD COLUMN "new_identifier" char(64);--> statement-breakpoint
ALTER TABLE "pools" ADD COLUMN "base_identifier" char(64);--> statement-breakpoint
ALTER TABLE "pools" ADD COLUMN "quote_identifier" char(64);--> statement-breakpoint
ALTER TABLE "pools" ADD COLUMN "processed" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "pools" ADD COLUMN "enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "swaps_v2" ADD COLUMN "identifier" char(64);--> statement-breakpoint
ALTER TABLE "swaps_v2" ADD COLUMN "base_identifier" char(64);--> statement-breakpoint
ALTER TABLE "swaps_v2" ADD COLUMN "quote_identifier" char(64);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pool_liquidity_changes" ADD CONSTRAINT "pool_liquidity_changes_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pool_liquidity_changes" ADD CONSTRAINT "pool_liquidity_changes_position_id_pool_positions_identifier_fk" FOREIGN KEY ("position_id") REFERENCES "public"."pool_positions"("identifier") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pool_positions" ADD CONSTRAINT "pool_positions_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "legacy_amm__apy_blocks" ADD CONSTRAINT "legacy_amm__apy_blocks_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "legacy_amm__apy_days" ADD CONSTRAINT "legacy_amm__apy_days_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "legacy_amm__pools" ADD CONSTRAINT "legacy_amm__pools_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "legacy_tvls" ADD CONSTRAINT "legacy_tvls_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tokens" ADD CONSTRAINT "tokens_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prices_usd_daily" ADD CONSTRAINT "prices_usd_daily_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prices_usd_hourly" ADD CONSTRAINT "prices_usd_hourly_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prices_usd" ADD CONSTRAINT "prices_usd_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pools" ADD CONSTRAINT "pools_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_identifier_unique" UNIQUE("identifier");--> statement-breakpoint
ALTER TABLE "pools" ADD CONSTRAINT "pools_new_identifier_unique" UNIQUE("new_identifier");--> statement-breakpoint
ALTER TABLE "swaps_v2" ADD CONSTRAINT "swaps_v2_identifier_unique" UNIQUE("identifier");