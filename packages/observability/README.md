# `@repo/observability`

**SHARED**

Logging, error reporting, status. Used everywhere. Never console.log.

## Public surface

- `@repo/observability/logger`
- `@repo/observability/errors`
- `@repo/observability/keys`

`private/` is not listed in `exports` and is therefore unreachable from outside this
package — by module resolution, not by convention (00 §3.1).

Tests live beside the code they test (00 §3.8).
