# Bookmarking

## Purpose

Let a user keep a private list of items they want to return to later.

## Principle

Ada saves a post, then saves another. Her list shows the newer bookmark first.
Saving the first post again is refused. Removing it succeeds once and is refused
the second time. Bob's bookmarks are independent of Ada's. Clearing an item
removes its bookmarks from every user's list and succeeds when none exist.

## Types

```types
external User
  An application-owned identity used in the user role.

external Item
  An application-owned identity used in the item role.
```

## State

```state
a set of Bookmarks with
  a user    User
  an item   Item
  a savedAt Date

Rule: a user has at most one bookmark for a given item.
Rule: clearItem removes every bookmark of the item and is idempotent: clearing an item with no bookmarks changes nothing and is not refused.
Rule: items are opaque identities; Bookmarking neither creates nor validates them.
```

## Actions

```actions
save(user: User, item: Item, at: Date) : returns (bookmark: Bookmark)
  where no bookmark has this user and item
  then
    add a new bookmark with user, item, and savedAt at
    returns bookmark
  where some bookmark has this user and item
  then
    refuses BOOKMARK_ALREADY_EXISTS "This user has already saved this item."

unsave(user: User, item: Item) : returns (bookmark: Bookmark)
  where some bookmark has this user and item
  then
    delete that bookmark
    returns bookmark
  where no bookmark has this user and item
  then
    refuses BOOKMARK_NOT_FOUND "There is no such bookmark to remove."

clearItem(item: Item) : returns (item: Item)
  where true
  then
    remove every bookmark of item
    returns item
```

## Queries

```queries
_getSaved (user: String) : many (item: String, savedAt: Date)
  answers the user's bookmarks newest first
  answers no rows when none match

_isSaved (user: String, item: String) : one (saved: Flag)
  answers whether the User has bookmarked the Item
```
