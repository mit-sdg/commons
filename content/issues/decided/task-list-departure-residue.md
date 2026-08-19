---
milestone: later
concepts:
  - Tasking
  - Roling
  - Categorizing
---

# Reconcile stale task assignees left by an interrupted departure

## Current behavior

Leaving a task list revokes the departing profile's membership, and a separate
reaction then releases the open tasks in that list still recorded against that
profile. Revocation is what ends authority and personal reads: the leaver
immediately loses the list, and their own task view no longer shows anything
from it, because that view keeps only lists the profile still belongs to.

The release is a courtesy to whoever remains, and Commons promises no
cross-concept rollback. A fault or a process restart between the revocation and
the fan-out, or a task assigned concurrently with the departure, can leave a
task in the list still recorded against a profile who is no longer a member.
Remaining members see that assignee and can release or replace it by hand.
Completed and canceled tasks keep their recorded assignee by design and are
never released.

## Desired behavior

A member who has left holds no open task in that list, without a remaining
member having to notice and act. Reconciliation runs from list state rather than
from the departure event alone, so an interrupted fan-out is repaired the next
time the list is read or swept.

## Acceptance condition

Application tests interrupt the release fan-out after revocation and then show
that a later read of the list reports no open task assigned to a profile without
membership. A task assigned during a concurrent departure reaches the same
answer. A completed or canceled task keeps its recorded assignee in every case,
and no test relies on the departing profile's own reads to hide the residue.
