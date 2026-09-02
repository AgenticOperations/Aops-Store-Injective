/**
 * RING 3 · IRREVERSIBLE ⚠ — money and authority
 * `@repo/custody/vendor-facts` — documented Altana vendor assumptions.
 *
 * Per `final-review-docs/04` §12.5. Do NOT guess atomicity or session-key rotation.
 * Status constants only — no fabricated "confirmed" claims against deployed contracts.
 */

/** Vendor fact verification status. */
export type VendorFactStatus = 'resolved' | 'open' | 'unverified'

export interface VendorFact {
  id: string
  question: string
  status: VendorFactStatus
  /** Cited source when resolved; explicit gap note when open. */
  note: string
}

/**
 * Altana vendor assumptions tracked by this repo. Checked against `docs.altana.network`
 * on 2026-09-02 per doc 04 §12.5. Two items remain open pending deployed-contract
 * verification — flagged for human review, not assumed fine.
 */
export const ALTANA_VENDOR_FACTS = {
  /** §12.5 — RESOLVED 2026-09-02 against Altana SDK docs. */
  SPEND_CAP_REFILLS_PER_PERIOD: {
    id: 'spend_cap_refills_per_period',
    question:
      "Is grantSession's spend cap cumulative and non-refilling for the session's life, or does it refill per period?",
    status: 'resolved',
    note: 'Refilling. spend: [{ limit, period: "day" | "hour", token }] caps movement per token per rolling period (`docs.altana.network`, §12.5).',
  },
  /** §12.5 — RESOLVED 2026-09-02 against Altana Keystore docs. */
  KEYSTORE_AUTHORIZATION_STATE_ONLY: {
    id: 'keystore_authorization_state_only',
    question: 'Does the Keystore expose remaining budget readably, or only the original grant?',
    status: 'resolved',
    note: 'Authorization state only (exists / not revoked / not expired). No spend or consumption fields (`docs.altana.network`, §12.5).',
  },
  /** §12.5 — STILL OPEN. Needs deployed contract, not docs alone. */
  PER_PERIOD_CAP_ATOMICITY: {
    id: 'per_period_cap_atomicity',
    question:
      'Is the per-period spend cap enforced atomically inside execute against concurrent calls within the same period?',
    status: 'open',
    note: 'Undocumented in Altana docs. Requires verification against the deployed session contract before treating "chain is the only check" as settled (doc 04 §12.5, §9.2).',
  },
  /** §12.5 — STILL OPEN. */
  SESSION_KEY_ROTATION: {
    id: 'session_key_rotation',
    question:
      "Can a session's signing key be rotated without a fresh grantSession human signature?",
    status: 'open',
    note: 'Undocumented either way in cited Altana docs (doc 04 §12.5). FLAGGED FOR HUMAN REVIEW.',
  },
} as const satisfies Record<string, VendorFact>

export type AltanaVendorFactId = keyof typeof ALTANA_VENDOR_FACTS
