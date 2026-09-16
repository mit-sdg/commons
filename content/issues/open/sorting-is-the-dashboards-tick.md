---
milestone: later
concepts:
  - Commissioning
  - Reasoning
---

# Sorting runs on the dashboard's tick, and an idle tick still writes

## Current behavior

While a round is open with automatic sorting on, each open dashboard asks the
sort endpoint every three seconds. A tick with nothing to do, because the tray
is empty, an ask is still out, the round is locked, or the last ask failed in
the past thirty seconds, reads its gates and records one declined Commissioning
proposal, which expires after an hour: the account that decides which branch
answers reaches the branches only through an action's input or output, and
`prepare` is that action. So a quiet room with two dashboards writes forty
declined proposals a minute, and a run whose dashboards are all closed is not
sorted until a round closes, since the close's final ask is the only sort no
dashboard makes.

## Unresolved decision

Whether sorting becomes the run's behavior, with reactions on a hand-in and on
the close in place of the dashboard's tick and a bounded retry in place of the
thirty-second cooldown, or whether the tick keeps its shape and gains a
carrying action that records nothing when there is no work.

## Acceptance condition

An open round with nothing to sort costs no write per tick, and a round with a
card in the tray is sorted whether or not a dashboard is open.
