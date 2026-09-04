# Trashing

## Purpose

Let an item be moved to trash, restored, or removed permanently.

## Principle

Maya trashes a draft, recording who did it and when. She restores it, trashes
it again, and then purges it. Restoring or purging an item outside the trash is
refused, as is trashing an item already there.

## Types

```types
external User
  An application-owned identity used in the user role.

external Item
  An application-owned identity used in the item role.
```

## State

```state
a set of Trashed with
  an item     Item
  a trashedBy User
  a trashedAt Date

Rule: at most one trashed entry has each item.
Rule: items are opaque identities; Trashing neither creates nor validates them.
```

## Actions

```actions
trash(item: Item, by: User, at: Date) : return (item: Item)
  where item not in trashed
  then
    add item to trashed with trashedBy by and trashedAt at
    return item
  where item in trashed
  then
    refuse ITEM_ALREADY_TRASHED "This item is already in the trash."
restore(item: Item) : return (item: Item)
  where item in trashed
  then
    remove item from trashed
    return item
  where item not in trashed
  then
    refuse ITEM_NOT_TRASHED "This item is not in the trash."
purge(item: Item) : return (item: Item)
  where item in trashed
  then
    remove item from trashed
    return item
  where item not in trashed
  then
    refuse ITEM_NOT_TRASHED "This item is not in the trash."
```

## Queries

```queries
_isTrashed (item: String) : one (trashed: Boolean)
  answers whether the Item is in trash

_getTrashed () : many (item: String, trashedBy: String, trashedAt: Date)
  answers every trashed item in trash order with who trashed it and when
  answers no rows when none match

_trashedItems () : one (items: Seq)
  answers every trashed item as one value: an ordered sequence of item
  identities in trash order
  answers an empty sequence when nothing is in the trash
```
