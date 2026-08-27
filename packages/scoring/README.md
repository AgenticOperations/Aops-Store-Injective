# `@repo/scoring`

**RING 0 · PURE — no I/O, imports nothing**

weight() / score() / confidence() / sybil-independence math. Versioned: every result carries the methodology version that produced it.

## Public surface

- `@repo/scoring/score`
- `@repo/scoring/weight`
- `@repo/scoring/independence`
- `@repo/scoring/version`

`private/` is not listed in `exports` and is therefore unreachable from outside this
package — by module resolution, not by convention (00 §3.1).

Tests live beside the code they test (00 §3.8).
