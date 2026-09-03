---
milestone: later
concepts:
  - Questioning
  - Publishing
  - Responding
---

# Distinguish the live domain's designed branch answers over HTTP

## Current behavior

The live composition answers several designed cases with authored words:
`RUN_OPEN` when editing a questionnaire whose run is open, `NOT_QUIZ_READY`
when launching a quiz that proposes no answers, `AT_EDGE` when moving a
question past its end, `FORM_FIXED` when adopting a refinement that proposes
the other form, and `CLOSED`, `NOT_PART`, `INCOMPLETE`, and `NOT_SUBMITTED` on
the participation endpoints. The HTTP profile projects every error into its
public category, so all of these reach the browser as `CONFLICT` or
`INVALID_REQUEST`. The frontend keeps the distinctions by deciding them
client-side from data it already holds — it disables Launch while no question
proposes an answer, disables Hand in until a quiz is whole, disables the edge
move buttons, and reads the run's open flag from the face — so the collapsed
categories are backstops rather than the user's experience.

## Unresolved decision

Decide whether these cases should remain error envelopes at all, or become
designed success answers carrying their own words (`{ handedIn: false, reason }`),
which would survive the category projection and let the participant screen
speak the composition's own sentences without duplicating the rules
client-side.

## Standing

Decided for the live relay endpoints on 2026-09-02: the boundary should pass
the refusal word beside its category (an engine change still to
come); until it does, the client-side rules are the home of
each distinction, and the words and their sentences live in
`frontend/src/components/live/refusals.ts`. The questionnaire cases named
above follow the same route.

## Acceptance condition

Either the participation endpoints answer these cases as designed data whose
words reach the browser unchanged, with wire and browser tests reading them, or
a recorded decision keeps the category backstops and names the client-side
rules as the one home of each distinction.
