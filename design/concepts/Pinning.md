# Pinning

## Purpose

Let a scope keep selected items above its ordinary listing, ordered by priority.

## Principle

An administrator pins an announcement in a discussion. A second item with a
higher priority appears first, and changing a priority changes the order.
Pinning the same item twice in one scope is refused. Unpinning it succeeds once;
unpinning it again or changing the priority of an unpinned item is refused. The
same item may be pinned independently in another scope. Clearing an item
removes all of its pins and succeeds when none exist.

## Types

```types
external Item
  An application-owned identity used in the item role.

external Scope
  An application-owned identity used in the scope role.
```

## State

```state
a set of Pins with
  an item     Item
  a scope     Scope
  a priority  Number
  a pinnedAt  Date
```

A scope has at most one pin for a given item.

`clearItem` removes every pin of the item. It is idempotent: clearing an item
with no pins changes nothing and is not refused. Items and scopes are opaque
identities; Pinning neither creates nor validates them.

`clearItem` removes every pin of the item. It is idempotent: clearing an item
with no pins changes nothing and is not refused. Items and scopes are opaque
identities; Pinning neither creates nor validates them.

## Actions

```actions
pin(item: Item, scope: Scope, priority: Number, at: Date) : return (pin: Pin)
  where no pin has this item and scope
  then
    add a new pin with item, scope, priority, and pinnedAt at
    return pin
  where some pin has this item and scope
  then
    refuse ITEM_ALREADY_PINNED "This item is already pinned in this scope."

unpin(item: Item, scope: Scope) : return (pin: Pin)
  where some pin has this item and scope
  then
    delete that pin
    return pin
  where no pin has this item and scope
  then
    refuse ITEM_NOT_PINNED "There is no such pin to remove."

setPriority(item: Item, scope: Scope, priority: Number) : return (pin: Pin)
  where some pin has this item and scope
  then
    set that pin's priority to priority
    return pin
  where no pin has this item and scope
  then
    refuse ITEM_NOT_PINNED "There is no such pin to reprioritize."

clearItem(item: Item) : return (item: Item)
  where true
  then
    remove every pin of item
    return item
```

## Queries

```queries
_getPinned (scope: String) : many (item: String, priority: Number)
  answers the scope's pinned items with highest priority first, with later pins breaking ties
  answers no rows when none match

_isPinned (item: String, scope: String) : one (pinned: Boolean)
  answers whether the Item is pinned in the Scope
```
