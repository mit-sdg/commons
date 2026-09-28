---
milestone: later
concepts:
  - Pinning
  - Categorizing
  - Relaying
---

# Carry the picked piles in the order the closed wall shows them

## Decision at completion

A round opens with the picked piles in the order the closed wall shows them: fullest first, and piles of the same size in the order they were made. That is the order the dashboard, the projector and the phones show on the wall the piles are picked from, and the order Top picks in. The order the piles were tapped is shown on no screen, so the next round's choices and parts do not follow it. Decided on 2026-09-27. Whether every phone shows a vote's choices in the same order is a separate question, [recorded on its own](../open/a-vote-shows-its-choices-in-one-order-on-every-phone.md).

## Resolution at completion

Each press of Open sends the picked piles in the closed wall's order (`shownPicks` in `frontend/src/components/live/run-relay-board.tsx`), and the server forms the round's choices, parts or context in the order the request names them (`openingGroups`, specified in `design/compositions/live/relays.md`). The open path's specification says so.

## Verification at completion

`frontend/src/components/live/run-relay-board.test.ts` checks that Open sends the picked piles fullest first. `tests/app/relay-carries.test.ts` opens a vote on picks in a chosen order and reads its choices back in that order.
