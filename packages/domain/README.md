# `@repo/domain`

**RING 0 · PURE — no I/O, imports nothing**

Entities, state machines, transition guards, shared types. The vocabulary of the whole system.

## Public surface

- `@repo/domain/entities`
- `@repo/domain/state-machines`
- `@repo/domain/guards`
- `@repo/domain/types`

`private/` is not listed in `exports` and is therefore unreachable from outside this
package — by module resolution, not by convention (00 §3.1).

Tests live beside the code they test (00 §3.8).
