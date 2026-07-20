---
milestone: public-deployment
concepts: []
---

# Preserve occurrence logs across restarts

## Current behavior

MongoDB preserves concept state, but the application and gateway occurrence
logs remain in memory. After a restart, the new process cannot find the last
occurrence whose handling completed or tell whether an interrupted action
should continue. Replaying work manually can perform a world effect a second
time.

## Unresolved decision

Define what happens when the process stops after an action starts but before it
finishes. Define how the next process finds the last occurrence whose handling
completed and continues from the following occurrence. Define how completion
of a world effect is recorded so that recovery cannot perform it twice.

## Acceptance condition

Restart tests stop the process before and after each action outcome is
recorded. The new process finds the last occurrence whose handling completed,
handles the interrupted request as designed, continues with the next
occurrence, and never performs the same world effect twice.
