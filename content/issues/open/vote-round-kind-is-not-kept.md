---
milestone: later
concepts:
  - Questioning
  - Relaying
---

# A round's kind is read off its content, so a bare Vote is a Write after a reload

## Current behavior

The editor names a round's kind — Write, List, Vote — but nothing stores it:
the run reads the kind off the question's choices, parts, and takes. A Vote
round given neither choices nor a take is therefore a Write round to the
server. The editor now refuses to launch such a round while the card holds
the pressed kind in memory ("Add choices, or take an earlier round's
piles."); after a reload, or from the overview or the shelf, the same relay
reads as a Write round and Launch is live again.

## Unresolved decision

Whether the kind is Questioning's to keep (a question of the vote form with
no choices yet), Relaying's (a leg's kind), or stays derived, with the guard
moved to the launch endpoint where every path meets it.

## Acceptance condition

A Vote round with nothing to vote on is refused a launch from every screen
and after a reload, with the sentence the editor already says.
