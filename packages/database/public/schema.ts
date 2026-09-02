/**
 * RING 2 · OWNED STATE — our database
 * `@repo/database/schema` — public contract. Named exports only.
 *
 * Schema, migrations, typed client. Owns nothing but storage.
 *
 * Six tables, translation only — every field is already named across `final-review-docs/01`
 * §4-5, `final-review-docs/04` §6.1-6.2/§8.1, and `architecture/01` §1.3-1.5. Status columns
 * mirror `@repo/domain/entities`'s vocabulary verbatim; this file does not invent parallel
 * enums for the same concept.
 */

import type {
  AccountStatus,
  AuthorizationRail,
  AuthorizationStatus,
  CredentialStatus,
  EscrowVariant,
  JobStatus as ListingJobExecutionStatus,
  ListingStatus,
} from '@repo/domain/entities'
import type { Category, TrustTier } from '@repo/domain/types'
import { relations, sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// -------------------------------------------------------------------------------------------
// Enums — one Postgres enum per `@repo/domain` status/vocabulary type. Values are copy-pasted
// from `packages/domain/public/entities.ts` and `types.ts`, not re-derived. Each value array is
// declared `as const satisfies readonly <DomainType>[]` so a typo'd or drifted value fails
// `tsc` at compile time rather than silently diverging from `@repo/domain`'s vocabulary.
// -------------------------------------------------------------------------------------------

const CATEGORY_VALUES = [
  'rebalancing',
  'grid_trading',
  'yield_optimization',
  'health_factor_monitoring',
] as const satisfies readonly Category[]
export const categoryEnum = pgEnum('category', CATEGORY_VALUES)

const TRUST_TIER_VALUES = ['Low', 'Medium', 'High'] as const satisfies readonly TrustTier[]
export const trustTierEnum = pgEnum('trust_tier', TRUST_TIER_VALUES)

const LISTING_STATUS_VALUES = [
  'DISCOVERED',
  'CLAIMED',
  'OWNERSHIP_VERIFIED',
  'ENDPOINT_VERIFIED',
  'LIVE',
  'DEGRADED',
  'SUSPENDED',
  'REVOKED',
] as const satisfies readonly ListingStatus[]
export const listingStatusEnum = pgEnum('listing_status', LISTING_STATUS_VALUES)

const ACCOUNT_STATUS_VALUES = [
  'UNFUNDED',
  'FUNDED',
  'RESTRICTED',
  'SUSPENDED',
] as const satisfies readonly AccountStatus[]
export const accountStatusEnum = pgEnum('account_status', ACCOUNT_STATUS_VALUES)

const CREDENTIAL_STATUS_VALUES = [
  'PENDING',
  'ACTIVE',
  'ROTATING',
  'EXPIRED',
  'REVOKED',
] as const satisfies readonly CredentialStatus[]
export const credentialStatusEnum = pgEnum('credential_status', CREDENTIAL_STATUS_VALUES)

/** `final-review-docs/04` §3's caller table — `dlg` (delegated session, e.g. a coding agent
 * riding an Altana session key) vs `svc` (an agent's own long-lived service credential). No
 * equivalent union exists in `@repo/domain` yet, so this one has no `satisfies` cross-check. */
export const credentialTierEnum = pgEnum('credential_tier', ['dlg', 'svc'])

/** `final-review-docs/04` §8.1's token format — `bsc` (mainnet) / `tbsc` (testnet), never
 * interchangeable. */
export const credentialNetEnum = pgEnum('credential_net', ['bsc', 'tbsc'])

const AUTHORIZATION_RAIL_VALUES = [
  'ALTANA_SESSION',
  'ERC8183_ESCROW',
  'AACP_PROGRAM',
  'X402_PAYMENT',
] as const satisfies readonly AuthorizationRail[]
export const authorizationRailEnum = pgEnum('authorization_rail', AUTHORIZATION_RAIL_VALUES)

const ESCROW_VARIANT_VALUES = ['PLAIN', 'AACP_PROGRAM'] as const satisfies readonly EscrowVariant[]
export const escrowVariantEnum = pgEnum('escrow_variant', ESCROW_VARIANT_VALUES)

const AUTHORIZATION_STATUS_VALUES = [
  'PENDING',
  'GRANTED',
  'EXPIRED',
  'REVOKED',
] as const satisfies readonly AuthorizationStatus[]
export const authorizationStatusEnum = pgEnum('authorization_status', AUTHORIZATION_STATUS_VALUES)

/** `architecture/01` §1.5's evidence source table proof types. No `@repo/domain` union exists
 * for this yet, so no cross-check — this is the schema's own vocabulary, cited directly. */
export const proofTypeEnum = pgEnum('proof_type', [
  'IDENTITY',
  'CAPABILITY',
  'EXECUTION',
  'OUTCOME',
  'AUTHORITY',
  'SETTLEMENT',
  'RELIABILITY',
])

/** `@repo/domain`'s persistent-service execution lifecycle (`architecture/01` §1.4) — distinct
 * from the settlement-status enum below. See the `jobs` table doc-comment. */
const JOB_EXECUTION_STATUS_VALUES = [
  'CONFIGURED',
  'AUTHORIZED',
  'ACTIVE',
  'RUNNING',
  'PAUSED',
  'DEGRADED',
  'ATTENTION_REQUIRED',
  'EXPIRED',
  'REVOKED',
  'ARCHIVED',
] as const satisfies readonly ListingJobExecutionStatus[]
export const jobExecutionStatusEnum = pgEnum('job_execution_status', JOB_EXECUTION_STATUS_VALUES)

/** The milestone plan's draft settlement state machine (`docs/build/2026-09-02-v1-milestone-plan-kc.md`
 * §3 item 2, Chunk 3a) — `HELD → RELEASED / REFUNDED / DISPUTED`. This is the escrow/session
 * settlement outcome, never to be confused with `jobExecutionStatusEnum` above. */
export const jobSettlementStatusEnum = pgEnum('job_settlement_status', [
  'HELD',
  'RELEASED',
  'REFUNDED',
  'DISPUTED',
])

// -------------------------------------------------------------------------------------------
// Listing — `final-review-docs/01` §4's ladder + category (Chunk 1's enum) + trust tier.
// Mirrors `packages/domain/public/entities.ts`'s `Listing` interface field-for-field.
// -------------------------------------------------------------------------------------------

export const listings = pgTable('listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: text('agent_id').notNull(),
  category: categoryEnum('category').notNull(),
  status: listingStatusEnum('status').notNull().default('DISCOVERED'),
  /** Separate, non-blocking axis from `status` — `null` until `status` first reaches `LIVE`,
   * then compulsorily `'Low'` (`01` §4.4, `01` §5). */
  trustTier: trustTierEnum('trust_tier'),
  ownerWallet: varchar('owner_wallet', { length: 42 }).notNull(),
  /** `erc8004_ref` — null for Agent-Studio pending registrations claimed by domain TXT record
   * instead of an on-chain anchor (`01` §4.1). */
  erc8004ChainId: integer('erc8004_chain_id'),
  erc8004TokenId: text('erc8004_token_id'),
  /** Declared service endpoint from `services[]` — probed by `census`, never the `agentURI`
   * manifest (`final-review-docs/01` §4.3). */
  declaredEndpoint: text('declared_endpoint'),
  /** Consecutive successful endpoint probes; resets to 0 on any failure. Three in a row gates
   * `OWNERSHIP_VERIFIED → ENDPOINT_VERIFIED` and recovers `DEGRADED → LIVE` (`architecture/01`
   * §1.2, `architecture/03` §3.2). */
  endpointProbeSuccessCount: integer('endpoint_probe_success_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// -------------------------------------------------------------------------------------------
// Evidence — append-only, immutable. `architecture/01` §1.5's field list verbatim.
//
// NOTE on `methodology_version`: explicitly NOT a column here. §1.5 is unambiguous that
// time-decay/methodology is applied *at read time* by the scoring engine — baking a version
// into the row would make old rows describe a methodology that no longer matches how they're
// actually being read. `@repo/scoring` stamps it on the computed result, never on this table.
//
// NOTE on `jobId`/`authorizationId` nullability: §1.5's field list does not explicitly mark
// these nullable (only `tx_hash` is called out), but the evidence source table two paragraphs
// later lists sources that exist before any Job or Authorization does — a self-declared
// `agentURI` capability (L0) and a marketplace onboarding execution test (L2) both predate a
// buyer's hire. Making these two columns nullable is the only way those documented sources are
// representable at all; treated here as a required inference, not invented scope, and called
// out in the handoff report rather than silently assumed.
//
// Append-only is enforced at the schema level via the `aops_app` role's grants (see
// `migrations/0001_aops_app_role_and_evidence_append_only.sql`) — SELECT + INSERT only, no
// UPDATE/DELETE grant, not just application discipline.
// -------------------------------------------------------------------------------------------

export const evidence = pgTable(
  'evidence',
  {
    evidenceId: uuid('evidence_id').primaryKey().defaultRandom(),
    jobId: uuid('job_id'),
    agentId: text('agent_id').notNull(),
    versionHash: text('version_hash').notNull(),
    authorizationId: uuid('authorization_id'),
    /** Open-ended per category/action (health-factor react, rebalance, heartbeat, …) — no
     * closed vocabulary named in the cited docs, so this stays free text rather than an
     * invented enum. */
    actionType: text('action_type').notNull(),
    txHash: text('tx_hash'),
    proofType: proofTypeEnum('proof_type').notNull(),
    /** `L0`-`L6`, `@repo/domain/types`'s `EvidenceLevel` union — enforced by the CHECK below
     * since Postgres has no native "small closed integer union" column type. */
    evidenceLevel: smallint('evidence_level').notNull(),
    source: text('source').notNull(),
    /** Discriminated union per source (`{aacp_job_id, evaluator_address, proof_hash}` for AACP
     * rows, `{kpi_computation_id, block_range}` for marketplace-KPI rows) — `null` for
     * self-declared. Stored as `jsonb`, typed by the writing package (`@repo/evidence`, Chunk
     * 3b), not re-typed here. */
    verificationRef: jsonb('verification_ref'),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('evidence_level_range', sql`${table.evidenceLevel} >= 0 AND ${table.evidenceLevel} <= 6`),
    index('evidence_agent_id_idx').on(table.agentId),
    index('evidence_job_id_idx').on(table.jobId),
    index('evidence_authorization_id_idx').on(table.authorizationId),
  ],
)

// -------------------------------------------------------------------------------------------
// Account — `final-review-docs/04` §6.1. One per wallet address. Never authenticated against
// directly, holds no secret — spend caps/expiry live exactly once, on-chain.
// -------------------------------------------------------------------------------------------

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
    status: accountStatusEnum('status').notNull().default('UNFUNDED'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('accounts_wallet_address_idx').on(table.walletAddress)],
)

// -------------------------------------------------------------------------------------------
// Credential — `final-review-docs/04` §6.2, token format §8.1. One per running instance, never
// shared. `kid` is the public, indexed lookup key; only `SHA-256(secret)` is ever stored — there
// is deliberately no column capable of holding the plaintext secret (§8.1's schema-level
// constraint, not app discipline).
// -------------------------------------------------------------------------------------------

export const credentials = pgTable(
  'credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    /** Ed25519 public key generated locally at enrollment (`04` §6.3) — the private half never
     * reaches us. */
    devicePubKey: text('device_pub_key').notNull(),
    status: credentialStatusEnum('status').notNull().default('PENDING'),
    tier: credentialTierEnum('tier').notNull(),
    net: credentialNetEnum('net').notNull(),
    /** `kid` — 22-char Crockford base32, public, indexed, NOT secret (`04` §8.1). */
    kid: varchar('kid', { length: 22 }).notNull(),
    /** `SHA-256(secret)` as a 64-char hex digest. The secret itself (43-char base64url, 32
     * CSPRNG bytes) is displayed to the caller exactly once at enrollment and never persisted
     * anywhere — this column is the only credential-verification material this table holds. */
    secretHash: varchar('secret_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('credentials_kid_idx').on(table.kid),
    index('credentials_account_id_idx').on(table.accountId),
  ],
)

// -------------------------------------------------------------------------------------------
// Authorization — `architecture/01` §1.3, scoped to `ALTANA_SESSION` and `ERC8183_ESCROW` for
// v1 (Chunk 1's guard-scope note). Mirrors `@repo/domain/entities`'s `AuthorizationScope`
// discriminated union exactly: a `rail` column as the discriminant (also useful for indexing
// without decoding JSON), plus a `scope` jsonb column holding whichever rail-specific payload
// that union's `scope` field carries for the row's rail — `AltanaSessionScope`,
// `Erc8183EscrowScope`, or `{}` for the two inert v1 variants (`AACP_PROGRAM`, `X402_PAYMENT`).
//
// NOTE: `AltanaSessionScope.spendCap.amount` and `Erc8183EscrowScope.fundedAmount` are `bigint`
// in `@repo/domain` — `JSON`/`jsonb` cannot round-trip `bigint` natively, so the package writing
// this column (`@repo/access`, Chunk 3e) must serialize those as decimal strings. Flagged here
// rather than silently assumed; this package only owns the column type (`jsonb`), not the
// serialization convention of its writers.
// -------------------------------------------------------------------------------------------

export const authorizations = pgTable(
  'authorizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id),
    buyerWallet: varchar('buyer_wallet', { length: 42 }).notNull(),
    /** E12 — "the only gate in the system." Enforced by `domain`'s `passesHiringGate` guard,
     * never re-derived here. */
    buyerMinimumTrustTier: trustTierEnum('buyer_minimum_trust_tier').notNull(),
    status: authorizationStatusEnum('status').notNull().default('PENDING'),
    rail: authorizationRailEnum('rail').notNull(),
    /** The rail-specific payload — see the table doc-comment above for the round-trip shape. */
    scope: jsonb('scope').notNull(),
    /** Only meaningful when `rail = 'ERC8183_ESCROW'` — mirrors `Erc8183EscrowScope.escrowVariant`
     * as a real column (not just buried in `scope`) since Job settlement fee logic (`jobs` table
     * below) branches on `PLAIN` vs `AACP_PROGRAM` and shouldn't have to decode jsonb to do it. */
    escrowVariant: escrowVariantEnum('escrow_variant'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('authorizations_listing_id_idx').on(table.listingId),
    index('authorizations_buyer_wallet_idx').on(table.buyerWallet),
  ],
)

// -------------------------------------------------------------------------------------------
// Job — folds two related-but-distinct concepts together, per the milestone plan's explicit
// instruction (`docs/build/2026-09-02-v1-milestone-plan-kc.md` §4 Chunk 3a):
//
//   `executionStatus`  — `@repo/domain`'s persistent-service execution lifecycle
//                         (CONFIGURED/AUTHORIZED/ACTIVE/RUNNING/...), `architecture/01` §1.4.
//   `settlementStatus` — the escrow/session SETTLEMENT outcome, `HELD → RELEASED / REFUNDED /
//                         DISPUTED`, drafted in the milestone plan §3 item 2 for `@repo/settlement`
//                         (Chunk 4b) to own the transition logic for.
//
// Plus the fee fields from the milestone plan §2.1's fee structure:
//   - `feeBps` / `feeChargedAmount` — the flat 3-5% taken at `PLAIN` `ERC8183_ESCROW` release.
//   - `measuredPerformanceFee` — the `ALTANA_SESSION` rail's 10%-of-net-positive-PnL number.
//     v1 *displays* this, computed independently by E5 at session close/checkpoint; it is never
//     automatically collected (that's Phase C, §2.1) — nullable, populated only once measured.
// -------------------------------------------------------------------------------------------

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorizationId: uuid('authorization_id')
      .notNull()
      .references(() => authorizations.id),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id),
    executionStatus: jobExecutionStatusEnum('execution_status').notNull().default('CONFIGURED'),
    settlementStatus: jobSettlementStatusEnum('settlement_status').notNull().default('HELD'),
    /** Flat-rate fee, basis points (300-500 = 3-5%, milestone plan §2.1) — set at `PLAIN`
     * release, null until then. */
    feeBps: integer('fee_bps'),
    /** The actual amount charged under `feeBps`, recorded once at release. `numeric` (not
     * `bigint`) since it may represent a fractional-token amount depending on decimals. */
    feeChargedAmount: numeric('fee_charged_amount'),
    /** `ALTANA_SESSION` rail's stated-not-automated performance fee number — computed and
     * displayed at session close/checkpoint, never moves funds (milestone plan §2.1, §4 Chunk
     * 4b). Null until a checkpoint/close has actually measured it. */
    measuredPerformanceFee: numeric('measured_performance_fee'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'jobs_fee_bps_range',
      sql`${table.feeBps} IS NULL OR (${table.feeBps} >= 0 AND ${table.feeBps} <= 10000)`,
    ),
    index('jobs_authorization_id_idx').on(table.authorizationId),
    index('jobs_listing_id_idx').on(table.listingId),
  ],
)

// -------------------------------------------------------------------------------------------
// Relations — read-side convenience only, no behaviour.
// -------------------------------------------------------------------------------------------

export const credentialsRelations = relations(credentials, ({ one }) => ({
  account: one(accounts, { fields: [credentials.accountId], references: [accounts.id] }),
}))

export const authorizationsRelations = relations(authorizations, ({ one, many }) => ({
  listing: one(listings, { fields: [authorizations.listingId], references: [listings.id] }),
  jobs: many(jobs),
}))

export const jobsRelations = relations(jobs, ({ one }) => ({
  authorization: one(authorizations, {
    fields: [jobs.authorizationId],
    references: [authorizations.id],
  }),
  listing: one(listings, { fields: [jobs.listingId], references: [listings.id] }),
}))

// -------------------------------------------------------------------------------------------
// Inferred row types — for callers that want a plain TS shape without importing drizzle-orm.
// -------------------------------------------------------------------------------------------

export type ListingRow = typeof listings.$inferSelect
export type NewListingRow = typeof listings.$inferInsert
export type EvidenceRow = typeof evidence.$inferSelect
export type NewEvidenceRow = typeof evidence.$inferInsert
export type AccountRow = typeof accounts.$inferSelect
export type NewAccountRow = typeof accounts.$inferInsert
export type CredentialRow = typeof credentials.$inferSelect
export type NewCredentialRow = typeof credentials.$inferInsert
export type AuthorizationRow = typeof authorizations.$inferSelect
export type NewAuthorizationRow = typeof authorizations.$inferInsert
export type JobRow = typeof jobs.$inferSelect
export type NewJobRow = typeof jobs.$inferInsert
