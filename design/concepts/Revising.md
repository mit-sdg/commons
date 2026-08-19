# Revising

## Purpose

Keep numbered versions of an item's content so readers can compare its current
and earlier text.

## Principle

Amara's first post content is revision 1. Two edits create revisions 2 and 3,
each with its saved content and time. A reader can list the revisions, read the
latest one, or select revision 2. Clearing the item removes every revision and
succeeds when no history exists.

## Types

```types
external Item
  An application-owned identity used in the item role.
```

## State

```state
a set of Revisions with
  an item    Item
  a number   Number
  a content  String
  a savedAt  Date

Rule: record keeps every supplied statement of content.
Rule: revision numbers start at 1 for each item; record assigns one more than the item's highest recorded number and stores the supplied at value as savedAt.
Rule: clearItem removes the item's complete history and is idempotent.
Rule: items are opaque identities; Revising neither creates nor validates them.
```

## Actions

```actions
record(item: Item, content: String, at: Date) : return (revision: Revision, number: Number)
  where true
  then
    add a new revision with item, content, and savedAt at, numbered one past the item's highest standing revision (or 1)
    return revision, number

clearItem(item: Item) : return (item: Item)
  where true
  then
    delete every revision with item item
    return item
```

## Queries

```queries
_getRevisions (item: String) : many (revision: String, number: Number, content: String, savedAt: Date)
  answers every Revision of the Item
  orders rows by number from lowest to highest
  answers no rows when the Item has no Revisions

_getRevision (item: String, number: Number) : optional (revision: String, number: Number, content: String, savedAt: Date)
  answers the Revision with this Item and number
  answers no row when it does not exist

_getLatest (item: String) : optional (revision: String, number: Number, content: String, savedAt: Date)
  answers the highest-numbered Revision of the Item
  answers no row when the Item has no Revisions
```
