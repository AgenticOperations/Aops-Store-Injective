# `@app/api`

Machine-facing surface — agent-to-agent, MCP, public API. Same gates as `web`, different
transport (00 Part 5).

**Hono + `@hono/zod-openapi`.** `/openapi.json` is generated from the same zod schemas that
validate requests, so the published contract cannot drift from the running code.

## The rule for this app

Routes validate input and call `@repo/*`. Business logic never lives in a handler (00 §3.5).
The hiring gate lives in `@repo/domain` — this surface calls the same function `web`, `console`
and `jobs` call. The day it is reimplemented here is the day the machine surface admits a hire
the human surface would have refused.
