---
milestone: later
concepts:
  - Suggesting
  - Insisting
---

# A placing reply made only of no-op lines settles the insistence without an offering

## Resolution at completion

A `place` line naming a card already in the pile it names is a no-op line,
dropped from the reading. A reply made only of such lines, or a reply with no
placements over an empty tray, now reads `nothing`: usable, offering nothing,
and not stood upon. The reaction that offers lines runs only for a `placed`
reading, so Suggesting is never asked to offer an empty list, and the reaction
that settles an insistence watches the reasoner's answer rather than the
offering: any usable reading — `placed`, `nothing`, or `lid` — settles
whatever was being insisted on for the round.

## Decision at completion

The reading answers a distinct kind for "nothing to place" instead of the offer
reaction skipping an empty list: the second alone would have left the insistence
standing until the next usable reply, which is the state the issue names. The
settle reaction keys on the answer so that a usable reply settles the insistence
whether or not it has a line to offer, which is what the design already said in
words.

## Verification at completion

Computation tests read a reply of only held cards as `nothing` with no lines
and no reason, and an empty tray answered with no placements as `nothing`
against a tray with a waiting card as `neither`. An application test stands an
insistence on a round, sorts both cards by hand under the repair ask, serves
the reply, and finds no insistence standing, nothing pending, and one pile.
