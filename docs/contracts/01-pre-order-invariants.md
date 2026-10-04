# Pre-Order Check Invariants
1. Orders targeting market IDs outside `allowed_market_ids` are rejected immediately.
2. Orders with notional value exceeding `max_notional_per_order` are rejected.
3. If an account has experienced a loss breach, it rejects any order that increases net exposure.
