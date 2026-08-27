# `@app/api`

Machine-facing surface: agent-to-agent, MCP, public API. Same guards as web, different transport.

Apps validate input and call packages. Business logic never lives in a route handler,
a task body, or a component (00 §3.5). Composition happens here (00 §5.2).
