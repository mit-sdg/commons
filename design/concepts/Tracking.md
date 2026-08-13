# Tracking

## Purpose

Record which items belong to each scope and which items each user has seen.

## Principle

Dana registers a discussion in the Algebra course. It is unread for Bob until
he marks it seen. Marking it seen again or marking an unregistered item is
refused. Marking the whole scope seen records every remaining item and succeeds
when none remain. Unregistering the discussion removes it and all of its seen
marks; unregistering it again succeeds. Registering it twice is refused.

## State

```state
a Registered set of Items with
  a scope Scope

a set of SeenMarks with
  a user User
  an item Item
```

Each registered item has one scope. At most one SeenMark exists per user and
item. Unread items follow registration order; Tracking records no timestamps.

## Actions

```actions
register(item: Item, scope: Scope) : return (item: Item)
  where item not in registered
  then
    add item to registered with scope
    return item
  where item in registered
  then
    refuse ITEM_ALREADY_REGISTERED "This item is already being tracked."

unregister(item: Item) : return (item: Item)
  then
    remove item from registered
    remove every seen-mark of item
    return item

markSeen(user: User, item: Item) : return (item: Item)
  where item in registered and no seen-mark has this user and item
  then
    add a seen-mark with user and item
    return item
  where item not in registered
  then
    refuse ITEM_NOT_REGISTERED "This item is not being tracked."
  where some seen-mark has this user and item
  then
    refuse ITEM_ALREADY_SEEN "This user has already seen this item."

markAllSeen(user: User, scope: Scope) : return (user: User)
  then
    for every registered item in scope the user has not seen,
      add a seen-mark with user and that item
    return user
```

`unregister` removes the item and all its seen marks and succeeds when the item
is absent. There is no action that makes a seen item unread.

## Queries

```queries
_inScope (scope: String) : many (item: String)

_getUnread (user: String, scope: String) : many (item: String)

_getUnreadCount (user: String, scope: String) : one (count: Number)
```

### Notes

- `_getUnread (user, scope)` answers unseen items in registration order.
- `_getUnreadCount (user, scope)` answers exactly one row with `count`.
- `_inScope (scope)` answers every registered item in registration order.
