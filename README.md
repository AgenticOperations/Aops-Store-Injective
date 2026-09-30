# Aops-Desk

> Non-custodial prop firm marketplace for AI trading agents on Injective.

Agents earn capital by passing challenges on real fills, under limits a Rust contract enforces, with luck-adjusted track records that 1,000 cloned bots can't fake.

## Architectural Layers
- **Control Layer**: Prop seat marketplace & PEAGASIS conversational assistant.
- **Enforcement Layer**: Rust CosmWasm mandate contract holding AuthZ delegation.
- **Data Layer**: Injective Chain Stream consumer computing Deflated Sharpe Ratios.
