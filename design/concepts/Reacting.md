# Reacting

## Purpose

Let a person add or remove a named response, such as a thumbs-up or heart, on a
target.

## Principle

Noah reacts to a post with "up." Mara adds her own "up" and a "heart." Each
person may add one reaction of each kind to the target. Noah's second "up" is
refused. Removing it succeeds once and is refused the second time. Clearing a
target removes every reaction and succeeds when none exist.

`clearTarget` removes every reaction on the target. It is idempotent: clearing
a target with no reactions changes nothing and is not refused. Targets are
opaque identities; Reacting neither creates nor validates them.

- `_getReactionsForTarget (target)` answers its reactions in creation order.
- `_getReactionsByUser (reactor)` answers the person's reactions in creation
  order.
- `_countByKind (target)` answers one row per reaction kind with its count.
- `_hasReacted (reactor, target, kind)` answers exactly one row with `reacted`.

## Types

```types
external Person
  The person identity affected by the behavior.

external Target
  The application object affected by the behavior.
```

## State

```state
a set of Reactions with
  a reactor   Person
  a target    Target
  a kind      String
  a reactedAt Date
```

A person has at most one reaction of a given kind on a target.

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

_getReactionsByUser (reactor: String) : many (reaction: String, target: String, kind: String)

_countByKind (target: String) : many (kind: String, count: Number)

_hasReacted (reactor: String, target: String, kind: String) : one (hasReacted: Boolean)
```
