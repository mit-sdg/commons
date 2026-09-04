---
milestone: later
concepts:
  - Drafting
---

# The draft page's Quiz or Survey choice never reaches the describe endpoint

## Current behavior

The draft page offers three segments, Quiz, Survey, and Relay. Relay plans a
relay and sends the brief to the relay's own drafting. Quiz and Survey both
send the brief to `/live/drafts/describe`, whose input is the request alone,
so the segment the author chose reaches the model nowhere: the model decides
quiz or survey from the wording of the brief. The two segments differ only in
the placeholder and the example chips under the box.

## Unresolved decision

Whether the describe endpoint should take the kind beside the request and
the drafting passage state it, or whether the two segments should become one
"Quiz or survey" segment whose brief says which.

## Acceptance condition

A brief sent from the Survey segment drafts a survey, and one sent from the
Quiz segment drafts a quiz, whatever the brief's wording; or the page offers
one segment for both and says so.
