# Locking

## Purpose

Record when a target is locked and allow that lock to be removed later.

## Principle

When the deadline passes, Dana locks a report and the action records the time.
Locking it again is refused. After an extension, Dana unlocks it. Unlocking an
unlocked report is also refused.

## State

```state
a set of Locks with
  a target   Target
  a lockedAt Date
```

Each target has at most one lock.

## Actions

```actions
lock (target: Target, at: Date) : return (), refuse (message: String)
  where no lock has this target
  then
    add a new lock with target and lockedAt at
    return
  where a lock has this target
  then
    refuse "This is already locked."

unlock (target: Target) : return (), refuse (message: String)
  where a lock has this target
  then
    delete the lock
    return
  where no lock has this target
  then
    refuse "This is not locked."
```

## Questions

- `_isLocked (target)` answers exactly one row with `locked`.
- `_getLocked ()` answers every locked target in lock order with its lock time.
