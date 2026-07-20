# ConceptName

## Purpose

What this behavior is for, in one or two plain sentences.

## Principle

A short story with named people. Show the behavior changing over time and
include its main refusal.

## State

```state
a set of Things with
  a requiredFact Type
  an optional note Type

a Pending set of Things
```

## Actions

```actions
create (requiredFact: Type) : return (thing: Thing)
  then
    add a new thing with requiredFact
    add thing to pending
    return thing

advance (thing: Thing) : return (), refuse (message: String)
  where thing in pending
  then
    remove thing from pending
    return
  where thing not in pending
  then
    refuse "This thing cannot advance."
```

Each `refuse` sentence is the normative human explanation. Keep any exposed
implementation detail consistent with it. The concept registry assigns the
refusal's stable code and public category.

## Queries

Name each standing question the implementation exposes. State whether it
answers exactly one row, at most one row, or any number of rows. State its row
shape and any ordering promise here once.
