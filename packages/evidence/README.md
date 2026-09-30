# `@repo/evidence`

**RING 2 · OWNED STATE — our database**

Append-only evidence writes and queries. Never mutates a row. CANNOT import scoring/ (00 §6.2).

## Public surface

- `@repo/evidence/write`
- `@repo/evidence/query`

`private/` is not listed in `exports` and is therefore unreachable from outside this
package — by module resolution, not by convention (00 §3.1).

Tests live beside the code they test (00 §3.8).
