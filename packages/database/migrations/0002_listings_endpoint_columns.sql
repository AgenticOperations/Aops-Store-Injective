-- Chunk 3c — endpoint probe state on `listings` for claim-time verification and LIVE↔DEGRADED
-- recovery (`final-review-docs/01` §4.3, §10; `architecture/01` §1.2).

ALTER TABLE "listings" ADD COLUMN "declared_endpoint" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "endpoint_probe_success_count" integer DEFAULT 0 NOT NULL;
