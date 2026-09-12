---
milestone: later
concepts:
  - Notifying
  - Tasking
---

# Name who changed a task in its notification mail

## Current behavior

A notification records an optional actor, and group-membership mail uses it: the
acting member travels on the Grouping action that raises the notification, so
"You were added to the group" now names who added you.

Task mail cannot do the same. The acting identity in `/tasks/assign`,
`/tasks/retime`, `/tasks/complete`, `/tasks/reopen`, `/tasks/cancel`, and
`/tasks/uncancel` is resolved from the session by a state read, and a value read
from state cannot be carried past the first step of a consequence chain — the
notification is raised after the Tasking action, so the actor is out of reach by
then. Those notifications record no actor and their mail names none.

## Unresolved decision

The reachable fix is to make the actor part of the Tasking action, so it travels
on the action record the notification reacts to. Tasking's purpose is to name who
is answerable for a piece of work, not who last touched it, so recording an actor
on every lifecycle action widens it in a direction its purpose excludes. Whether
"who last changed this task" is legitimate task state, or belongs to an
occurrence log outside Tasking, is not settled.

## Acceptance condition

Task notification mail names who made the change, with a test covering an
assignment and a state change, or the design records that task events are
deliberately unattributed and says why.
