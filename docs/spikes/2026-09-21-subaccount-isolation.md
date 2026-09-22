# Spike: Injective Subaccount Isolation Mechanics
**Date:** 2026-09-21
**Author:** 18Abhinav07

## Overview
On Injective, an Ethereum/Cosmos address can generate an arbitrary number of subaccounts.
A subaccount ID is a 32-byte hash formatted as:
`subaccountId = ethAddress (20 bytes) + subaccountIndex (12 bytes, zero-padded hex)`

## Critical Finding
- Subaccount index 0 is the default trading account, which shares balances with the main wallet.
- Subaccount index >= 1 isolates deposited collateral completely.
- For Aops-Desk prop seats, EVERY seat MUST allocate its own isolated subaccount (index >= 1).
