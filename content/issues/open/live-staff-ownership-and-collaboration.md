---
milestone: public-deployment
concepts:
  - Roling
  - Drafting
  - Publishing
  - Questioning
  - Relaying
  - Subscribing
---

# Define ownership and collaboration for live staff

## Current behavior

Authorship is recorded for live questionnaires and relays, but the `live:host` role is a
course-wide capability. Any staff member with that role can see, refine, edit, retire,
launch, monitor, and close live material created by another host. Relays widen this
considerably: planning and editing a relay, opening and closing its rounds, seating and
dismissing model participants, sorting and renaming the piles on a wall, removing cards,
picking, and taking drafted edits are all gated on the same course-wide capability, so a
second host can drive a room another host is standing in front of. The interface does
not explain whether this is intentional co-hosting or an absent ownership boundary.

## Unresolved decision

Whether all live hosts in a course are trusted co-hosts, whether only an author may
change and run their material, or whether questionnaires, relays, and runs need explicit
collaborators with separate view, edit, and host permissions. A running room raises the
question sharply: a run has one person in front of it, and whether that is a claim other
hosts must respect is undecided.

## Acceptance condition

The selected ownership model is stated in the live design and enforced consistently by
every drafting, questionnaire, relay, wall, edit, launch, monitoring, and close
endpoint. Tests with two staff accounts cover permitted collaboration and reject every
operation outside that boundary, and the interface makes ownership or shared control
visible.
