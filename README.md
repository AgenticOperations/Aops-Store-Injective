# Aops-Store-BNB

Agent marketplace for BNB Chain's "Build the Era" hackathon (Smart Money Era track) —
an ERC-8004-based discovery/comparison/hiring marketplace for BNB AI agents, covering the
four mandatory categories (rebalancing, grid trading, yield optimization, health-factor
monitoring), targeting the main track plus the Altana, TermiX, and PancakeSwap partner
tracks.

## Repo layout

- `docs/arch-wireframe-v0/` — architecture design docs, one file per section, written and
  verified through the `superpowers:brainstorming` process before any implementation.
  Section 1 (data model, state machines, proof/rating mechanics, AACP integration) is
  verified against primary sources (Altana docs, 8004scan Developer Hub, AACP whitepaper).
- `docs/agent-chats/` — raw research-chat exports used to seed design work. Gitignored;
  local-only, not build material.
- `HANDOFF.md` — append-only session log. Every agent session appends what it did before
  closing; never edit or delete prior entries.

## Branches

- `main` — stable.
- `planning/docs` — architecture/design docs land here first, before any code.

## Status

Pre-build. See `docs/arch-wireframe-v0/` for current design state.
