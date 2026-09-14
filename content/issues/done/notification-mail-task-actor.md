---
milestone: later
concepts:
  - Notifying
  - Tasking
---

# Task notification mail names no actor

## Resolution at completion

A notification records an optional actor. Group-membership mail and the inbox
entry beside it name the member who added or removed you, because the acting
member travels on the Grouping action that raises the notification.

Task events record no actor and their mail names none. The design says so and
says why, so a reader of the composition is not left wondering whether the gap
was an oversight.

## Decision at completion

The acting identity in the six task endpoints is resolved from the session by a
state read, and a value read from state cannot be carried past the first step of
a consequence chain. The notification is raised after the Tasking action, so the
actor is out of reach by then — the engine refuses the lowering outright rather
than failing quietly.

The only reachable fix is to make the actor part of a Tasking action, so it
travels on the action record the notification reacts to. Tasking's purpose is to
name who is answerable for a piece of work, not who last touched it, so that
widening was declined rather than forced. Should "who last changed this task"
ever become something Commons needs to show, it belongs in Tasking's state as a
deliberate addition, or in an occurrence log outside it — not smuggled in as an
input the concept ignores.

## Verification at completion

Membership attribution is covered in both directions, in the mail and in the
inbox row, and the rendered specification carries the optional actor. Task
notification mail is covered as naming a task, a group, a wall-time deadline, and
its details, and no actor.
