# Reacting

## Purpose

Let a person add or remove a named response, such as a thumbs-up or heart, on a
target.

## Principle

Noah reacts to a post with "up." Mara adds her own "up" and a "heart." Each
person may add one reaction of each kind to the target. Noah's second "up" is
refused. Removing it succeeds once and is refused the second time. Clearing a
target removes every reaction and succeeds when none exist.

## Types

```types
external Person
  An application-owned identity used in the person role.

external Target
  An application-owned identity used in the target role.
```

## State

```state
a set of Reactions with
  a reactor   Person
  a target    Target
  a kind      String
  a reactedAt Date

Rule: a person has at most one reaction of a given kind on a target.
Rule: clearTarget removes every reaction on the target and is idempotent: clearing a target with no reactions changes nothing and is not refused.
Rule: targets are opaque identities; Reacting neither creates nor validates them.
```

## Actions

```actions
react(reactor: Person, target: Target, kind: String, at: Date) : return (reaction: Reaction)
  where no reaction has this reactor, target, and kind
  then
    add a new reaction with reactor, target, kind, and reactedAt at
    return reaction
  where some reaction has this reactor, target, and kind
  then
    refuse REACTION_ALREADY_EXISTS "This person has already reacted to the target with this kind."

unreact(reactor: Person, target: Target, kind: String) : return (reaction: Reaction)
  where some reaction has this reactor, target, and kind
  then
    delete that reaction
    return reaction
  where no reaction has this reactor, target, and kind
  then
    refuse REACTION_NOT_FOUND "There is no such reaction to take back."

clearTarget(target: Target) : return (target: Target)
  where true
  then
    remove every reaction on target
    return target
```

## Queries

```queries
_getReactionsForTarget (target: String) : many (reaction: String, reactor: String, kind: String)
  answers its reactions in creation order
  answers no rows when none match

_getReactionsByUser (reactor: String) : many (reaction: String, target: String, kind: String)
  answers the person's reactions in creation order
  answers no rows when none match

_countByKind (target: String) : many (kind: String, count: Number)
  answers one row per reaction kind with its count
  answers no rows when none match

_hasReacted (reactor: String, target: String, kind: String) : one (hasReacted: Boolean)
  answers whether the Person has this kind of Reaction on the Target
```
