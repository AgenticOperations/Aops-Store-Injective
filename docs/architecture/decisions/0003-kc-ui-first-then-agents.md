---
created: 2026-08-27
status: decided
binds: PRODUCT-STATE.md, SCAFFOLD.md, 04b-category-agent-strategy-models.md §4b.10,
  03-category-agent-rebalancing.md §12, 0001-agents-repo-separation.md (Still open),
  2026-08-25-marketplace-engine-decomposition-kc.md §5
decided_by: KC
---

# Decision 0003 — KC scaffolds the UI now, then moves to the agents

## The conflict this resolves

Several docs sequence **agent engineering first** and **Builder Console deferred**:

- `04b` §4b.10: the rebalancer V3 spike "goes first, before anything else."
- `final-review-docs/03` §12: same line on the agents-repo row.
- `HANDOFF_KC.md` 2026-08-24: "Do not start Builder Console yet."
- `PRODUCT-STATE.md` (as of 2026-08-25): console stays deferred until architecture gaps close.
- Proof-engine §9 / `HANDOFF_KC.md` 2026-08-25: E5 grading and sandbox-compat assigned to KC
  *now*, because "you're building the agents."

KC's actual work order is the reverse: **scaffold the UI in this repo first, then move to the
agents and grow them progressively.** Those older lines were being read as "agent work is
current and halted on KC." They are not.

## Decision

**KC's queue, starting 2026-08-27:**

1. **Now — scaffold the UI** in this repository: `apps/web` (buyer marketplace) and
   `apps/console` (builder). Empty routes, layout, design-system wiring, page shells. Not the
   hire-card mechanics, not `grantSession`, not E11 product calls.
2. **Next — agents**, progressively, in their own repository (Decision 0001), once the UI
   scaffold is standing. E5 grading and sandbox-compat are defined **as each agent is framed**,
   not as a prerequisite to starting the UI.

## What this does not change

- `04b` §4b.10 / `03` §12 remain the **risk ranking inside the agents repo**. When agent work
  starts, the rebalancer V3 spike is still the first engineering item *there*. It is not KC's
  calendar for this week.
- Decision 0001 still holds: agents live in a separate repository. Part 9 item 6 (where that
  repo lives) still blocks **agent** scaffold, not UI scaffold.
- E11's four hire-card decisions (passkey auth, T1 vs T2, `period`, Layer A/B rendering) still
  block wiring the hire card. They do not block scaffolding pages around it.
- Sandbox-compat remains a build requirement for our four agents **when those agents are
  built**. It is not a reason to halt UI work.

## Why

The console/web trees already exist on `build/staging`. Sitting on them until E11 and the
agents repo are decided leaves the surfaces empty while the docs keep telling the next session
to start the rebalancer instead. UI-first is a sequencing call, not a design reversal.
