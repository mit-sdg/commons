---
milestone: repository-release
concepts:
  - Questioning
  - Relaying
  - Suggesting
---

# Take every offered line at once without crossing the added rounds

## Current behavior

Adding a round is four asks in a row: compose the round's questionnaire, add its
question, set the question's parts, and append the leg. Each later ask needs a
different part of the line's value, and a later ask can read the line again only
by looking back through what the request has already asked for. That look-back
answers once per matching ask, so when one request takes two `add` lines, each
later ask of one round's chain also sees the other round's line: the rounds come
out with each other's prompts or parts, with extra questions on a questionnaire
and extra legs on the relay.

Taking one line per request is exact, and every other kind of line — `title`,
`prompt`, `parts`, `choices`, `takes`, `move`, `remove` — is applied in one or
two asks that never look back, so an offering without added rounds is safe to
take at once. The panel therefore takes added rounds one at a time, and
`/live/edits/take-all` is safe only for an offering carrying at most one `add`.

## Unresolved decision

Whether adding a round should become one ask a request can repeat — a
questionnaire composed whole from its material — or whether taking every line at
once should apply added rounds one request at a time, leaving the endpoint to
answer only for the lines it can apply together.

## Acceptance condition

One request takes an offering that adds two rounds, and the relay reads back
with exactly those two rounds, each carrying its own title, prompt, parts, and
choices, with no extra question or leg.
