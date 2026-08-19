# Tracking

## Purpose

Record which items belong to each scope and which items each user has seen.

## Principle

Dana registers a discussion in the Algebra course. It is unread for Bob until
he marks it seen. Marking it seen again or marking an unregistered item is
refused. Marking the whole scope seen records every remaining item and succeeds
when none remain. Unregistering the discussion removes it and all of its seen
marks; unregistering it again succeeds. Registering it twice is refused.

## Types

```types
external User
  An application-owned identity used in the user role.

external Item
  An application-owned identity used in the item role.

external Scope
  An application-owned identity used in the scope role.
```

## State

```state
a set of Registered with
  an item  Item
  a scope  Scope

a set of SeenMarks with
  a user User
  an item Item

Rule: each registered item has one scope.
Rule: at most one SeenMark exists per user and item.
Rule: unread items follow registration order; Tracking records no timestamps.
Rule: unregister removes the item and all its seen marks and succeeds when the item is absent.
Rule: there is no action that makes a seen item unread.
```

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
  where true
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
  where true
  then
    for every registered item in scope the user has not seen,
      add a seen-mark with user and that item
    return user
```

## Queries

```queries
_inScope (scope: String) : many (item: String)
  answers every registered item in registration order
  answers no rows when none match

_getUnread (user: String, scope: String) : many (item: String)
  answers unseen items in registration order
  answers no rows when none match

_getUnreadCount (user: String, scope: String) : one (count: Number)
  answers the number of registered Items in the Scope that the User has not seen
```
