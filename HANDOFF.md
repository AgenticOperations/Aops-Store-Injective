# Handoff Log

Append-only. Each agent session adds a new entry below at session close — what was done,
what's still open, anything the next session needs to know. Never edit or delete prior
entries; correct forward with a new entry if something above turns out wrong.

---

## 2026-08-16 — repo bootstrap

- Initialized git repo, set default branch to `main`, added remote `origin` →
  `https://github.com/AgenticOperations/Aops-Store-BNB.git`.
- Created `.gitignore` (excludes `docs/agent-chats/`, standard Next.js/Foundry/node
  ignores), `README.md`, this `HANDOFF.md`.
- Created `docs/arch-wireframe-v0/01-data-model-state-machines.md` — Section 1 of the
  architecture design (six core objects: Agent/Listing/Authorization/Job-Service/Evidence/
  Performance; state machines; proof taxonomy; rating/scoring formula; AACP integration).
  Verified against primary sources on 2026-08-16 (Altana docs, 8004scan Developer Hub, AACP
  whitepaper + termix-agent-skills repo) — see the Provenance section at the top of that
  file for what was confirmed vs. corrected vs. new. Key decision made during verification:
  AACP integrated as a `PROGRAM`-type verification service only, never as a custody rail —
  its `CEX_CAPITAL` vault-based type has unshipped ("Planned") core contracts, so buyer
  capital stays entirely on Altana's Keystore/session rail.
- Created branch `planning/docs`; docs pushed there first, ahead of any code.
- Still open: Sections 2 onward of the architecture doc (module/repo layout mapping to the
  "three worlds" boundary, evidence/trust engine pipeline detail, category-agent execution
  architecture, hiring-flow/Altana integration detail, build phasing/sequencing) — not yet
  written. This is mid-way through the `superpowers:brainstorming` architectural-path
  process (approaches proposed and approved, Section 1 approved after two revision rounds,
  Sections 2+ not started). No implementation has begun.

## 2026-08-16 — Section 2 written, Section 1 & 3 corrected against live AACP state

- Created `docs/arch-wireframe-v0/02-module-boundaries-repo-layout.md` (package tree,
  `chain-adapters` split by submodule so `apps/web` stays execution-loop-blind, two distinct
  web↔worker channels, state-machine guards centralized in `core-domain`, deployment targets).
- Deep-audited Sections 1–3 directly against primary sources: raw AACP whitepaper text
  (curl'd, not WebFetch-summarized — WebFetch was caught fabricating a plausible-looking but
  non-literal function signature earlier this session), `gh api` reads of the full
  `termix-agent-skills` doc set (14 skill docs), and live `curl` calls to
  `aacp-backend.termix.live` (`/api/v1/config`, `/api/v1/stats`, and several `/api/v1/agents`,
  `/api/v1/jobs` shapes referenced from the skill docs).
- Corrected into `01-data-model-state-machines.md` (Provenance Addendum added): (1)
  `CEX_CAPITAL` is real and shipped (90,329 jobs network-wide) — it's CEX futures trading via
  a TEE, wrong domain for our four categories, not "unshipped" as previously stated; (2) AACP
  PROGRAM-proof evidence level downgraded L4→L3 network-wide — `GET /api/v1/config` returns
  `realGroth16: false`, so Groth16 proof isn't cryptographically enforced yet; designed to
  auto-upgrade to L4 when that flag flips, no schema change needed; (3) new-agent
  `reputationScore` default corrected 50→90 per the live `client-create-job.md` doc (flagged
  as an open discrepancy vs. whitepaper narrative, not fully closed); (4) added the real
  Client-side staking prerequisite (`createJob` reverts with `0x4e236e9a` without it) and the
  real `createJob(...)`/`setBudget(...)` ABI, replacing an assumed `fund()` step; (5) softened
  the Institutional trust-tier's AACP-dependency language to match the L3 finding.
- Wrote `docs/arch-wireframe-v0/03-evidence-trust-engine-pipeline.md` — ingestion, onboarding
  verification, AACP job orchestration (with the corrected ABI/staking/L3 findings baked in
  directly, plus a scheduled `claimRefund` sweep and a self-dealing guard that refuses to
  write Evidence if the Evaluator on one of our own Client/Provider jobs resolves to an
  identity we control), domain-KPI pipeline, performance rollup, sybil/independence
  recomputation, and idempotency/testnet-mainnet-parity posture.
- Investigated whether AACP assigns Evaluators to PROGRAM jobs via VRF or open bidding
  (relevant to how avoidable self-dealing risk is in practice): confirmed Provider assignment
  is Client-discretionary (`client-set-provider` skill, explicit `setProvider` call after
  reviewing submitted offers), but found **no equivalent Evaluator-assignment skill anywhere**
  in the 14-doc `termix-agent-skills` set — no `client-set-evaluator`, no evaluator-side
  browse/offer flow. Treated as evidence (by absence, not by an explicit spec statement) that
  Evaluator assignment is protocol-controlled rather than choosable by either side — this
  reduces but doesn't eliminate self-dealing risk (only 9 evaluators exist network-wide, so
  coincidental self-pairing isn't impossible), so the guard in 3.3/3.6 is built and tested on
  testnet from day one regardless.
- Explained to the user, in more depth and calibrated to a real mainnet deployment (not just
  demo risk): what `AACPStaking.registerEvaluatorStrategy` does, why self-evaluating our own
  jobs is a permanent integrity/anti-collusion-detection problem rather than a testnet-only
  concern, and that registering as a *general-purpose* PROGRAM Evaluator for the wider network
  (never assigned to our own jobs) is a legitimate, valuable, separate move — especially given
  only 9 evaluators exist network-wide.
- Confirmed with the user that the full build (staking, job orchestration, self-dealing guard,
  etc.) should be built and proven entirely on BSC Testnet (chain ID 97, using the AACP
  `Faucet` contract for test USDC) before any mainnet deployment; testnet→mainnet is designed
  as a `chain-adapters/{aacp,defi}` environment-config change only, never a code change —
  stated explicitly in 3.7.
- Committed and pushed Sections 1 (corrected) and 3 (new) to `planning/docs`.
- Still open: BSC-testnet PancakeSwap V3 addresses unconfirmed (mainnet addresses are
  confirmed); yield/health-factor lending protocol identity (candidate: Venus) unverified;
  Altana/8004scan testnet-endpoint availability assumed but not re-verified — all three must
  close before Section 4 depends on them. Section 4 (category-agent execution architecture)
  not yet started. `README.md`'s branch-protection/PR-workflow note still not added (small,
  repeatedly deferred, low urgency). No implementation has begun.
