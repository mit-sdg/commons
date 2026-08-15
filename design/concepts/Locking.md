# Locking

## Purpose

Record when a target is locked and allow that lock to be removed later.

## Principle

When the deadline passes, Dana locks a report and the action records the time.
Locking it again is refused. After an extension, Dana unlocks it. Unlocking an
unlocked report is also refused.

- `_isLocked (target)` answers exactly one row with `locked`.
- `_getLocked ()` answers every locked target in lock order with its lock time.

## Types

```types
external Target
  The application object affected by the behavior.
```

## State

```state
a set of Locks with
  a target   Target
  a lockedAt Date
```

Each target has at most one lock.

## Actions

```actions
lock(target: Target, at: Date) : return (target: Target)
  where no lock has this target
  then
    add a new lock with target and lockedAt at
    return target
  where a lock has this target
  then
    refuse TARGET_ALREADY_LOCKED "This is already locked."

unlock(target: Target) : return (target: Target)
  where a lock has this target
  then
    delete the lock
    return target
  where no lock has this target
  then
    refuse TARGET_NOT_LOCKED "This is not locked."
```

## Queries

```queries
_isLocked (target: String) : one (locked: Boolean)

_getLocked () : many (target: String, lockedAt: Date)
```
