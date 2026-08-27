# `@repo/discovery`

**RING 2 · OWNED STATE — our database**

Structured query -> candidate retrieval -> ranking -> explanation. Deterministic.

## Public surface

- `@repo/discovery/query`
- `@repo/discovery/rank`
- `@repo/discovery/explain`

`private/` is not listed in `exports` and is therefore unreachable from outside this
package — by module resolution, not by convention (00 §3.1).

Tests live beside the code they test (00 §3.8).
