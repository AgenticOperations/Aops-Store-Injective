# `@app/jobs`

Scheduled and event-driven tasks. THE COMPOSITION POINT. Retries with backoff, idempotent by key.

Apps validate input and call packages. Business logic never lives in a route handler,
a task body, or a component (00 §3.5). Composition happens here (00 §5.2).
