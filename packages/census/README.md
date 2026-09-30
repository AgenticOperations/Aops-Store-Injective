# `@repo/census`

**RING 1 · OBSERVATION — read-only, output is a cache**

Population-scale liveness probing. The only package that touches arbitrary third-party endpoints - treats every response as hostile.

## Public surface

- `@repo/census/probe`
- `@repo/census/keys`

`private/` is not listed in `exports` and is therefore unreachable from outside this
package — by module resolution, not by convention (00 §3.1).

Tests live beside the code they test (00 §3.8).
