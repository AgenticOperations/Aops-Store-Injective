-- Chunk 3a — dedicated application role + schema-level append-only enforcement on `evidence`.
--
-- `docs/final-review-docs/04-agent-side-onboarding-and-credentials.md` §8.1 and
-- `docs/architecture/01-data-model-state-machines.md` §1.5 both require Evidence to be
-- append-only, immutable, never mutated. The milestone plan's Chunk 3a verify step is explicit
-- that this must hold "at the schema level ... not just by convention" — a raw UPDATE/DELETE
-- issued by the application role must fail at the database.
--
-- This migration creates `aops_app`, the role every application package (this one included, and
-- later `@repo/evidence`/Chunk 3b, `@repo/listings`/Chunk 3c, `@repo/access`/Chunk 3e) connects
-- as for normal read/write traffic — never as the migration-owning superuser. It is created
-- NOLOGIN here (a role with no way to connect yet); a separate documented step,
-- `packages/database/scripts/setup-app-role.ts`, does `ALTER ROLE aops_app LOGIN PASSWORD ...`
-- reading the password from an environment variable, once per target database. Splitting it this
-- way means no password is ever checked into this migration file, while the *grants* (which are
-- genuinely part of this schema's shape, versioned alongside it) still live here.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'aops_app') THEN
    CREATE ROLE aops_app NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO aops_app;
--> statement-breakpoint

-- Evidence: SELECT + INSERT only. No UPDATE, no DELETE — ever. The REVOKE below is
-- belt-and-suspenders: privileges are already default-deny for a role until granted, so this
-- statement doesn't change behaviour today, but it makes the invariant survive a future
-- accidental `GRANT ALL` on this table without anyone having to remember why evidence is special.
GRANT SELECT, INSERT ON evidence TO aops_app;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON evidence FROM aops_app;
--> statement-breakpoint

-- Every other table gets full CRUD for the application role — this is ordinary owned state,
-- nothing here needs the append-only treatment.
GRANT SELECT, INSERT, UPDATE, DELETE ON listings, accounts, credentials, authorizations, jobs TO aops_app;
