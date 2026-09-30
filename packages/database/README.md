# `@repo/database`

**RING 2 · OWNED STATE — our database**

Schema, migrations, typed client. Owns nothing but storage.

## Public surface

- `@repo/database/client`
- `@repo/database/schema`
- `@repo/database/keys`

`private/` is not listed in `exports` and is therefore unreachable from outside this
package — by module resolution, not by convention (00 §3.1).

Tests live beside the code they test (00 §3.8).
