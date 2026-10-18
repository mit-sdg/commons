# Pinning

## Purpose

Let a scope keep selected items above its ordinary listing, ordered by priority.

## Principle

An administrator pins an announcement in a discussion. A second item with a
higher priority appears first, and changing a priority changes the order.
Pinning the same item twice in one scope is refused. Unpinning it removes the
pin; unpinning it again changes nothing and is not refused, so two hands that
unpin one item at once both succeed. Changing the priority of an unpinned item
is refused. The same item may be pinned independently in another scope.
Clearing an item removes all of its pins and succeeds when none exist.

## Types

```types
external Item
  An application-owned identity used in the item role.

external Scope
  An application-owned identity used in the scope role.
opaque Seq
  An ordered list of the values its argument names.
```

## State

```state
a set of Pins with
  an item     Item
  a scope     Scope
  a priority  Number
  a pinnedAt  Date

Rule: a scope has at most one pin for a given item.
Rule: concurrent pinning cannot create duplicate membership.
Rule: unpin and clearItem are idempotent: unpinning an item with no pin in the scope, or clearing an item with no pins, changes nothing and is not refused.
Rule: items and scopes are opaque identities; Pinning neither creates nor validates them.
```

## Actions

```actions
pin(item: Item, scope: Scope, priority: Number, at: Date) : returns (pin: Pin)
  where no pin has this item and scope
  then
    add a new pin with item, scope, priority, and pinnedAt at
    returns pin
  where some pin has this item and scope
  then
    refuses ITEM_ALREADY_PINNED "This item is already pinned in this scope."

unpin(item: Item, scope: Scope) : returns (item: Item)
  where true
  then
    delete the pin with this item and scope when one stands
    returns item

setPriority(item: Item, scope: Scope, priority: Number) : returns (pin: Pin)
  where some pin has this item and scope
  then
    set that pin's priority to priority
    returns pin
  where no pin has this item and scope
  then
    refuses ITEM_NOT_PINNED "There is no such pin to reprioritize."

clearItem(item: Item) : returns (item: Item)
  where true
  then
    remove every pin of item
    returns item
```

## Queries

```queries
_pinnedItems (scope: String) : one (items: Seq<String>)
  answers the pinned item identities as one ordered sequence, empty when none are pinned


_getPinned (scope: String) : many (item: String, priority: Number)
  answers the scope's pinned items with highest priority first, with later pins breaking ties
  answers no rows when none match

_isPinned (item: String, scope: String) : one (pinned: Flag)
  answers whether the Item is pinned in the Scope
```
