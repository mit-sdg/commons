# Bookmarking

## Purpose

Let a user keep a private list of items they want to return to later.

## Principle

Ada saves a post, then saves another. Her list shows the newer bookmark first.
Saving the first post again is refused. Removing it succeeds once and is refused
the second time. Bob's bookmarks are independent of Ada's. Clearing an item
removes its bookmarks from every user's list and succeeds when none exist.

## State

```state
a set of Bookmarks with
  a user    User
  an item   Item
  a savedAt Date
```

A user has at most one bookmark for a given item.

## Actions

```actions
save(user: User, item: Item, at: Date) : return (bookmark: Bookmark)
  where no bookmark has this user and item
  then
    add a new bookmark with user, item, and savedAt at
    return bookmark
  where some bookmark has this user and item
  then
    refuse BOOKMARK_ALREADY_EXISTS "This user has already saved this item."

unsave(user: User, item: Item) : return (bookmark: Bookmark)
  where some bookmark has this user and item
  then
    delete that bookmark
    return bookmark
  where no bookmark has this user and item
  then
    refuse BOOKMARK_NOT_FOUND "There is no such bookmark to remove."

clearItem(item: Item) : return ()
  then
    remove every bookmark of item
    return
```

`clearItem` removes every bookmark of the item. It is idempotent: clearing an
item with no bookmarks changes nothing and is not refused. Items are opaque
identities; Bookmarking neither creates nor validates them.

## Queries

```queries
_getSaved (user: String) : many (item: String, savedAt: Date)

_isSaved (user: String, item: String) : one (saved: Boolean)
```

### Notes

- `_getSaved (user)` answers the user's bookmarks newest first.
- `_isSaved (user, item)` answers exactly one row with `saved`.
