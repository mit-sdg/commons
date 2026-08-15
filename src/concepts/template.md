# ConceptName

## Purpose

What this behavior is for, in one or two plain sentences.

## Principle

A short story with named people. Show the behavior changing over time and
include its main refusal.

## Types

```types
external Owner
  The application identity that owns a thing.
```

## State

```state
a set of Things with
  an owner Owner
  a requiredFact String
  an optional note String

a Pending set of Things
```

## Actions

```actions
create(owner: Owner, requiredFact: String) : return (thing: Thing)
  where true
  then
    add a new thing with owner and requiredFact
    add thing to pending
    return thing

advance(thing: Thing) : return (thing: Thing)
  where thing in pending
  then
    remove thing from pending
    return thing
  where thing not in pending
  then
    refuse THING_NOT_PENDING "This thing cannot advance."
```

## Queries

```queries
_get(thing: Thing) : optional (owner: Owner, requiredFact: String, note: String)
  Returns no row when the thing does not exist.
```
