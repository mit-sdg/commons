---
milestone: later
concepts:
  - Drafting
---

# The draft page offers one segment for a quiz or a survey

## Resolution at completion

The draft page offers two segments, Quiz or survey and Relay. The brief sent
from the first goes to `/live/drafts/describe` as before, whose input is the
request alone; the placeholder says to say which of the two is wanted, and the
briefs offered under the box each name their form. A link that still asks for
`kind=quiz` or `kind=survey` opens the one segment.

## Decision at completion

The two segments were collapsed rather than the describe endpoint widened: the
drafting passage already asks when a brief could equally be a quiz or a survey
and never guesses the form, so the form belongs in the brief, in the author's
own words, and a second segment could only pretend to send it.

## Verification at completion

The frontend check and tests pass with the one segment; the tour walks the
draft page with `kind=relay`, which is unchanged.
