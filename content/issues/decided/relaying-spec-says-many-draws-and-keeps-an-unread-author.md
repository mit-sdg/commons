---
milestone: later
concepts:
  - Relaying
  - Suggesting
---

# Relaying's spec answers many draws per leg and keeps an author nobody reads

## Current behavior

Relaying's state rule says a leg has at most one draw, and drawing again sets that one draw's source and use. Its `_draws` and `_drawsOn` queries answer draws "in the order they were made" and `_plan` gives each leg a sequence of draws, as if a leg could hold several. A relay carries an `author` that no action compares, no refusal reads, and no query is asked for in the Principle; the composition reads it nowhere. Suggesting keeps a `position` on each suggestion and an `offeredAt` on each offering, which the Principle now gives a sentence each. These are the field-and-cardinality findings of the concept review of 2026-09-04; the prose findings were fixed in the same review.

## Desired behavior

`_draws` answers at most one row, the leg's draw, and `_plan` carries each leg's draw as one optional entry; `_drawsOn` stays many, since several legs may draw on one source. The relay's `author` is either dropped from the concept or given the sentence that reads it, which is a decision for the staff-ownership work in `live-staff-ownership-and-collaboration`. Both are signature changes, so the implementation, the composition's formers, and the goldens change with them.

## Acceptance condition

The spec's rules and queries agree on one draw per leg, the source check passes against the implementation, `bun run check` is green with the goldens re-pinned, and every relay field has a sentence in the Principle that reads it.
