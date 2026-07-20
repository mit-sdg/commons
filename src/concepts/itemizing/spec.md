# Itemizing

## Purpose

Describe how an item is assessed with a label, a maximum score, and optional
ordered criteria.

## Principle

Professor Lee configures the midterm as a grade item worth 100 points. She adds
Argument, worth 60, and Style, worth 40, in that order. A later `ensureItem`
request finds the existing item and leaves it unchanged. Adding a criterion to
an item that has not been configured is refused. Archiving the midterm removes
it from the active items.

## State

```state
a set of GradeItems with
  an item     Item
  a label     String
  a maxPoints Number

an Active   set of GradeItems
an Archived set of GradeItems

a set of Criteria with
  an item     Item
  a name      String
  a maxPoints Number
  a position  Number
```

At most one grade item is active for an item at a time. Criteria belong to the item and stand in position order. Whether a maximum is workable is a calculation over the input alone:

```computation
(maxPoints: Number) is a workable maximum : Bool
```

A maximum is workable when it is at least zero.

## Actions

```actions
configureItem (item: Item, label: String, maxPoints: Number) : return (gradeItem: GradeItem), refuse (message: String)
  where maxPoints is a workable maximum and a gradeItem with item is in active
  then
    set gradeItem's label to label and maxPoints to maxPoints
    return gradeItem
  where maxPoints is a workable maximum and no gradeItem with item is in active
  then
    add a new gradeItem with item, label, and maxPoints
    add gradeItem to active
    return gradeItem
  where maxPoints is not a workable maximum
  then
    refuse "The maximum must be at least zero."

ensureItem (item: Item, label: String, maxPoints: Number) : return (gradeItem: GradeItem)
  where a gradeItem with item is in active
  then
    return gradeItem
  where no gradeItem with item is in active
  then
    add a new gradeItem with item, label, and maxPoints
    add gradeItem to active
    return gradeItem

archiveItem (item: Item) : return (gradeItem: GradeItem), refuse (message: String)
  where a gradeItem with item is in active
  then
    remove gradeItem from active
    add gradeItem to archived
    return gradeItem
  where no gradeItem with item is in active
  then
    refuse "There is no active grade item for this."

addCriterion (item: Item, name: String, maxPoints: Number, position: Number) : return (criterion: Criterion), refuse (message: String)
  where a gradeItem with item is in active
  then
    add a new criterion with item, name, maxPoints, and position
    return criterion
  where no gradeItem with item is in active
  then
    refuse "There is no active grade item for this."

reviseCriterion (criterion: Criterion, name: String, maxPoints: Number, position: Number) : return (), refuse (message: String)
  where criterion in criteria
  then
    set criterion's name, maxPoints, and position from the inputs
    return
  where criterion not in criteria
  then
    refuse "There is no such criterion."

removeCriterion (criterion: Criterion) : return (), refuse (message: String)
  where criterion in criteria
  then
    delete criterion
    return
  where criterion not in criteria
  then
    refuse "There is no such criterion."
```

Configuring updates the label and maximum of an existing active item.
`ensureItem` returns an existing active item unchanged or creates one. Removing
a criterion removes only Itemizing's record of it.

## Questions

- `_getItem (item)` answers at most one active grade item.
- `_getItems ()` answers all active grade items in creation order.
- `_getCriteria (item)` answers the item's criteria in position order.
- `_getCriterion (criterion)` answers at most one criterion.
