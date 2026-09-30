# `@repo/market-data`

**RING 1 · OBSERVATION — read-only, output is a cache**

Pool state, positions, prices, APYs, protocol oracle reads. Oracle prices and DEX quotes are distinct concepts and are never interchanged.

## Public surface

- `@repo/market-data/positions`
- `@repo/market-data/pools`
- `@repo/market-data/prices`
- `@repo/market-data/keys`

`private/` is not listed in `exports` and is therefore unreachable from outside this
package — by module resolution, not by convention (00 §3.1).

Tests live beside the code they test (00 §3.8).
