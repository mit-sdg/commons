---
milestone: later
concepts:
  - Categorizing
---

# A pile can show its count with no cards until the page reloads

## Current behavior

In a rehearsal with twenty-two phones, a pile of twenty cards showed its count with an empty body on the lecturer's dashboard and on the projector for over a minute, while a second staff dashboard and the phones showed its cards. Reloading the page brought the cards back. It was seen once, and it has not been reproduced or confirmed on an earlier build.

## Unresolved decision

Whether the pile's cards were held back on those screens by the wall's placing animation or by the wall read they kept, and what the screen does instead when its cards and its counts disagree.

## Acceptance condition

A reproduction that shows the cause, and a test that drives a wall into that state and checks that every pile's body shows the cards its count names without a reload.
