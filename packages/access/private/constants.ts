/** Challenge nonce TTL — `final-review-docs/04` §7.2 step 2. */
export const CHALLENGE_TTL_MS = 120_000

/** Standing-tier credential sliding window — `04` §11.1. */
export const VALID_UNTIL_DAYS = 90

/** Per-account live-credential ceiling — `04` §7.2. */
export const MAX_LIVE_CREDENTIALS = 5

/** Proof `iat` skew tolerance — `04` §8.2 step 5. */
export const IAT_SKEW_SECONDS = 90

/** `jti` replay window matches `iat` skew on both sides. */
export const JTI_TTL_MS = IAT_SKEW_SECONDS * 2 * 1000

export const TOKEN_PREFIX = 'aops_'

export const AGENT_ENROLLMENT_DOMAIN_NAME = 'AgentOps Marketplace'
export const AGENT_ENROLLMENT_DOMAIN_VERSION = '1'

export const AGENT_ENROLLMENT_TYPES = {
  AgentEnrollment: [
    { name: 'intent', type: 'string' },
    { name: 'wallet', type: 'address' },
    { name: 'devicePubKey', type: 'bytes32' },
    { name: 'issuedAt', type: 'uint64' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const
