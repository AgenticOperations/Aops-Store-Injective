# `@repo/settlement`

**RING 3 · IRREVERSIBLE ⚠ — money and authority**

RING 3. Escrow funding, per-call payments, staked verification jobs, refund sweeps.

## Public surface

- `@repo/settlement/escrow`
- `@repo/settlement/payments`
- `@repo/settlement/keys`

`private/` is not listed in `exports` and is therefore unreachable from outside this
package — by module resolution, not by convention (00 §3.1).

Tests live beside the code they test (00 §3.8).
