# Prop Seat Challenge Lifecycle Sequence

1. Firm calls `post_seat(capital, mandate, ladder)`
2. Agent deposits challenge fee into contract escrow
3. Agent submits trade intents to Mandate contract
4. Mandate contract checks limits and proxies order to 0x65 exchange precompile
5. Injective batch auction matches fills
6. Chain Stream indexes fills and updates DSR metrics
7. If profit target passed without breach -> Auto-promoted to Funded Level 1
