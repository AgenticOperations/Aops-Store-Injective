# Aops-Store-BNB

Agent marketplace for BNB Chain's "Build the Era" hackathon (Smart Money Era track) —
an ERC-8004-based discovery/comparison/hiring marketplace for BNB AI agents, covering the
four mandatory categories (rebalancing, grid trading, yield optimization, health-factor
monitoring), targeting the main track plus the Altana, TermiX, and PancakeSwap partner
tracks.

See `PRODUCT-STATE.md` for current status, `CLAUDE.md` for how work is organized in this repo.

## Repo layout

- `docs/unverified-ideas-and-flows/` — raw ideas and flows from either collaborator, before
  any structuring or verification. Nothing here is binding.
- `docs/architecture/` — structured, verified design docs, one file per section
  (`00`-`05`), plus `decisions/` for ADRs recording why a given change was made. Written and
  verified through the `superpowers:brainstorming` process; content can still evolve.
- `docs/final-review-docs/` — canonical, factually-proven-robust versions of feature docs,
  headed for actual review. Source of truth for any topic it covers; see its own `README.md`.
- `docs/agent-chats/` — raw research-chat exports used to seed design work. Gitignored;
  local-only, not build material.
- `HANDOFF_RYUK.md` / `HANDOFF_KC.md` — append-only, per-collaborator session logs. Every
  session appends to the file matching whoever drove it; never edit or delete prior entries.

## Branches

- `main` — stable.
- `planning/docs` — architecture/design docs land here first, before any code.

## Status

Pre-build. See `PRODUCT-STATE.md` for the current snapshot, `docs/architecture/` for full
design detail.
