# `@repo/design-system`

**SHARED**

Components. Imports no service package, ever.

## Public surface

- `@repo/design-system/components`

`private/` is not listed in `exports` and is therefore unreachable from outside this
package — by module resolution, not by convention (00 §3.1).

Tests live beside the code they test (00 §3.8).
