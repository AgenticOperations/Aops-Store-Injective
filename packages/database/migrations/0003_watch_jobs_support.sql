-- Chunk 5b/5c support tables: pool observation accumulation (E5), task queue (watch→jobs),
-- and agent score cache (E6 evidence rollup).

CREATE TABLE IF NOT EXISTS "pool_observations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pool_address" varchar(42) NOT NULL,
  "observation_index" integer NOT NULL,
  "block_number" bigint NOT NULL,
  "tick_cumulative" bigint NOT NULL,
  "seconds_per_liquidity_cumulative_x128" numeric NOT NULL,
  "block_timestamp" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pool_observations_unique" UNIQUE("pool_address","observation_index","block_number")
);

CREATE INDEX IF NOT EXISTS "pool_observations_pool_address_idx" ON "pool_observations" ("pool_address");

CREATE TABLE IF NOT EXISTS "pending_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_name" varchar(64) NOT NULL,
  "idempotency_key" varchar(256) NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  CONSTRAINT "pending_tasks_idempotency_key_unique" UNIQUE("idempotency_key")
);

CREATE INDEX IF NOT EXISTS "pending_tasks_status_idx" ON "pending_tasks" ("status");

CREATE TABLE IF NOT EXISTS "agent_scores" (
  "agent_id" text PRIMARY KEY NOT NULL,
  "score" numeric,
  "confidence" numeric,
  "sample_size" integer DEFAULT 0 NOT NULL,
  "methodology_version" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
