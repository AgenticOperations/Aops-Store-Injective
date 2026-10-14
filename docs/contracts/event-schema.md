# Mandate Contract Event Schema
Used by the Rust Chain Stream Indexer to build real-time track records:
- `aops.mandate.seat_created`: Broadcast on seat instantiation.
- `aops.mandate.order_approved`: Broadcast before order proxying.
- `aops.mandate.seat_breached`: Broadcast on daily loss or drawdown trigger.
