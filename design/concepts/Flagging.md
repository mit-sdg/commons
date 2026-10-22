# Flagging

## Purpose

Let a person report a concern about a target and let a moderator resolve all
open concerns about that target as upheld or dismissed.

## Principle

Sam reports a post as spam, and Rita reports the same post for another reason.
The post's open-flag count is now two. A moderator dismisses the reports, which
closes both flags. Sam cannot open another flag on the post while his first is
open. Unknown outcomes and targets without open flags are refused.

## Types

```types
external User
  An application-owned identity used in the user role.

external Target
  An application-owned identity used in the target role.
```

## State

```state
a set of Reports with
  a reporter  User
  a target    Target
  a reason    String
  a createdAt Date

a set of Open Reports
a set of Upheld Reports
a set of Dismissed Reports
```

## Actions

```actions
flag(reporter: User, target: Target, reason: String, at: Date) : returns (flag: Report)
  where no report in open has this reporter and this target
  then
    add a new report as flag with reporter, target, reason, and createdAt at
    add flag to open
    returns flag
  where some report in open has this reporter and this target
  then
    refuses FLAG_ALREADY_EXISTS "You already have an open flag on this."

resolve(target: Target, outcome: String) : returns (target: Target)
  where outcome is neither "upheld" nor "dismissed"
  then
    refuses VALIDATION_FAILED "An outcome must be upheld or dismissed."
  where some report in open has this target
  then
    remove every report with this target from open
    add each of them to upheld if outcome is "upheld", or to dismissed if outcome is "dismissed"
    returns target
  where no report in open has this target
  then
    refuses FLAG_NOT_FOUND "There are no open flags on this."
clearTarget(target: Target) : returns (target: Target)
  where true
  then
    delete every report on target
    returns target
```

## Queries

```queries
_getOpenTargets () : many (target: String, count: Number)
  answers targets with open flags, highest count first
  answers no rows when none match

_getFlags (target: String) : many (flag: String, reporter: String, reason: String, status: String, createdAt: Date)
  answers every report on the target in creation order
  answers no rows when none match
```
