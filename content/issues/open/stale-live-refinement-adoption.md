---
milestone: later
concepts:
  - Drafting
  - Questioning
  - Revising
---

# Detect stale live drafts before adoption

## Current behavior

Two staff sessions can refine the same questionnaire from the same starting state.
Each receives a valid proposed draft, and adopting the second proposal overwrites
changes made by adopting the first without warning. The draft records its target
questionnaire but not a base revision that adoption can compare with the current
material.

## Unresolved decision

Whether stale adoption should be rejected and regenerated, presented as a
reviewable merge, or allowed only after an explicit confirmation showing the
intervening changes.

## Acceptance condition

An application test opens two refinements against one questionnaire and adopts the
first. Attempting to adopt the second cannot silently replace the first result: it
follows the selected conflict flow, clearly identifies that the source changed,
and preserves both authors' work until a staff member makes an informed choice.
