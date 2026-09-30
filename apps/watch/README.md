# `@app/watch`

RING-3-FORBIDDEN. The one always-on process. Holds chain subscriptions. DETECTS ONLY - enqueues a job and stops.

Apps validate input and call packages. Business logic never lives in a route handler,
a task body, or a component (00 §3.5). Composition happens here (00 §5.2).
