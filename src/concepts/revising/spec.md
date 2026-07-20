# Revising

## Purpose

Keep numbered versions of an item's content so readers can compare its current
and earlier text.

## Principle

Amara's first post content is revision 1. Two edits create revisions 2 and 3,
each with its saved content and time. A reader can list the revisions, read the
latest one, or select revision 2. Clearing the item removes every revision and
succeeds when no history exists.

## State

Revision numbers start at 1 for each item. `record` assigns one more than the
item's highest recorded number and stores the supplied `at` value as `savedAt`.

```state
a set of Revisions with
  an item    Item
  a number   Number
  a content  String
  a savedAt  Date
```

## Actions

```actions
record (item: Item, content: String, at: Date) : return (revision: Revision, number: Number)
  then
    add a new revision with item, content, and savedAt at, numbered one past the item's highest standing revision (or 1)
    return revision and number

clearItem (item: Item) : return ()
  then
    delete every revision with item item
    return
```

`record` keeps every supplied statement of content. `clearItem` removes the
item's complete history and is idempotent. Items are opaque identities; Revising
neither creates nor validates them.

## Questions

History reads do not refuse when an item has never been recorded:

- `_getRevisions (item)` — every revision of the item, ascending by number: `{revision, number, content, savedAt}` per row.
- `_getRevision (item, number)` — the zero-or-one revision at that number: `{revision, number, content, savedAt}`, or nothing.
- `_getLatest (item)` — the highest-numbered revision, zero-or-one: `{revision, number, content, savedAt}`, or nothing.
