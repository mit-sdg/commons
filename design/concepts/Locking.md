# Locking

## Purpose

Record when a target is locked and allow that lock to be removed later.

## Principle

When the deadline passes, Dana locks a report and the action records the time.
Locking it again is refused. After an extension, Dana unlocks it. Unlocking an
unlocked report is also refused.

## Types

```types
external Target
  An application-owned identity used in the target role.
```

## State

```state
a set of Locks with
  a target   Target
  a lockedAt Date

Rule: each target has at most one lock.
```

## Actions

```actions
lock(target: Target, at: Date) : returns (target: Target)
  where no lock has this target
  then
    add a new lock with target and lockedAt at
    returns target
  where a lock has this target
  then
    refuses TARGET_ALREADY_LOCKED "This is already locked."
unlock(target: Target) : returns (target: Target)
  where a lock has this target
  then
    delete the lock
    returns target
  where no lock has this target
  then
    refuses TARGET_NOT_LOCKED "This is not locked."
```

## Queries

```queries
_isLocked (target: String) : one (locked: Flag)
  answers whether the Target has a Lock

_getLocked () : many (target: String, lockedAt: Date)
  answers every locked target in lock order with its lock time
  answers no rows when none match
```
