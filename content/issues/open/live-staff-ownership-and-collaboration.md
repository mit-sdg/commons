---
milestone: public-deployment
concepts:
  - Roling
  - Drafting
  - Publishing
  - Questioning
---

# Define ownership and collaboration for live staff

## Current behavior

Authorship is recorded for live questionnaires, but the `live:host` role is a
course-wide capability. Any staff member with that role can see, refine, edit,
retire, launch, monitor, and close live material created by another host. The
interface does not explain whether this is intentional co-hosting or an absent
ownership boundary.

## Unresolved decision

Whether all live hosts in a course are trusted co-hosts, whether only an author may
change and run their material, or whether questionnaires and runs need explicit
collaborators with separate view, edit, and host permissions.

## Acceptance condition

The selected ownership model is stated in the live design and enforced consistently
by every drafting, questionnaire, launch, monitoring, and close endpoint. Tests with
two staff accounts cover permitted collaboration and reject every operation outside
that boundary, and the interface makes ownership or shared control visible.
