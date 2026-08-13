# Trashing

## Purpose

Let an item be moved to trash, restored, or removed permanently.

## Principle

Maya trashes a draft, recording who did it and when. She restores it, trashes
it again, and then purges it. Restoring or purging an item outside the trash is
refused, as is trashing an item already there.

## State

```state
a Trashed set of Items with
  a trashedBy User
  a trashedAt Date
```

## Actions

```actions
trash(item: Item, by: User, at: Date) : return ()
  where item not in trashed
  then
    add item to trashed with trashedBy by and trashedAt at
    return
  where item in trashed
  then
    refuse ITEM_ALREADY_TRASHED "This item is already in the trash."

restore(item: Item) : return ()
  where item in trashed
  then
    remove item from trashed
    return
  where item not in trashed
  then
    refuse ITEM_NOT_TRASHED "This item is not in the trash."

purge(item: Item) : return ()
  where item in trashed
  then
    remove item from trashed
    return
  where item not in trashed
  then
    refuse ITEM_NOT_TRASHED "This item is not in the trash."
```

## Queries

```queries
_isTrashed (item: String) : one (trashed: Boolean)

_getTrashed () : many (item: String, trashedBy: String, trashedAt: Date)
```

### Notes

- `_isTrashed (item)` answers exactly one row with `trashed`.
- `_getTrashed ()` answers every trashed item in trash order with who trashed it
  and when.
