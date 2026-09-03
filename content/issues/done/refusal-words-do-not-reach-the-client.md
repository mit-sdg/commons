---
milestone: repository-release
concepts: []
---

# Let the live screens say why a change was refused

## Decision at completion

The boundary passes the refusal word beside its category for the live
endpoints, and each live screen — the run dashboard, the relay setup page,
the phone — says the reason in one plain sentence in a person's words, never
the softened voice of a model. Decided 2026-09-02.

## Resolution at completion

The engine's HTTP package (`@mit-sdg/sync-engine-http`, a pinned release)
answers a failure with its category only and documents that domain details
are not exposed, so the word cannot cross the boundary without an engine
release; that change is asked of the engine. Each live screen
says the sentence now: the refusal words and their sentences have one home,
`frontend/src/components/live/refusals.ts`, and the screen that sent the
request reads which word stands behind the category from the state it holds
— which round is open, what a round takes from, whether this phone handed in
— then says that word's sentence, with the round's number when it has one.
When the boundary passes the word, the reading goes and the table stays.

## Verification at completion

The browser rehearsal reads the sentence on the dashboard for a round
opened out of order, on the setup page for a round removed while another
takes from it, and on the phone for a second hand-in.
