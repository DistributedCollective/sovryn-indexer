CREATE TABLE IF NOT EXISTS "pool_balance" (
	"id" serial PRIMARY KEY NOT NULL,
	"pool_id" integer NOT NULL,
	"user" char(42) NOT NULL,
	"time" varchar,
	"baseQty" varchar,
	"quoteQty" varchar,
	"chain_id" integer NOT NULL,
	"block" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"extra" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "pool_balances_comb_pkey" UNIQUE("user","chain_id","pool_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pool_balance" ADD CONSTRAINT "pool_balance_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pool_balance" ADD CONSTRAINT "pool_balance_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
