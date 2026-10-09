# Breach State Machine
When an open position drops past `max_trailing_drawdown_bps` or `max_daily_loss_bps`:
1. Seat status flips to `BREACHED`.
2. All non-reducing order intents are rejected immediately.
3. Allocator receives automated notification with 1-click capital reclaim.
