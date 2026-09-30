# `@repo/agent-registry`

**RING 1 · OBSERVATION — read-only, output is a cache**

Who exists, who owns what, what they claim. Reads identity/reputation registries and the external indexer.

## Public surface

- `@repo/agent-registry/registry`
- `@repo/agent-registry/keys`

`private/` is not listed in `exports` and is therefore unreachable from outside this
package — by module resolution, not by convention (00 §3.1).

Tests live beside the code they test (00 §3.8).
