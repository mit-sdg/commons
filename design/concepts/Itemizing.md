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

## Types

```types
external Item
  An application-owned identity used in the item role.
```

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

A maximum is workable when it is at least zero.

Configuring updates the label and maximum of an existing active item.
`ensureItem` returns an existing active item unchanged or creates one. Removing
a criterion removes only Itemizing's record of it.

Configuring updates the label and maximum of an existing active item.
`ensureItem` returns an existing active item unchanged or creates one. Removing
a criterion removes only Itemizing's record of it.

## Actions

```actions
configureItem(item: Item, label: String, maxPoints: Number) : return (gradeItem: GradeItem)
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
    refuse SCORE_OUT_OF_RANGE "The maximum must be at least zero."

ensureItem(item: Item, label: String, maxPoints: Number) : return (gradeItem: GradeItem)
  where a gradeItem with item is in active
  then
    return gradeItem
  where no gradeItem with item is in active
  then
    add a new gradeItem with item, label, and maxPoints
    add gradeItem to active
    return gradeItem

archiveItem(item: Item) : return (gradeItem: GradeItem)
  where a gradeItem with item is in active
  then
    remove gradeItem from active
    add gradeItem to archived
    return gradeItem
  where no gradeItem with item is in active
  then
    refuse GRADE_ITEM_NOT_FOUND "There is no active grade item for this."

addCriterion(item: Item, name: String, maxPoints: Number, position: Number) : return (criterion: Criterion)
  where a gradeItem with item is in active
  then
    add a new criterion with item, name, maxPoints, and position
    return criterion
  where no gradeItem with item is in active
  then
    refuse GRADE_ITEM_NOT_FOUND "There is no active grade item for this."

reviseCriterion(criterion: Criterion, name: String, maxPoints: Number, position: Number) : return (criterion: Criterion)
  where criterion in criteria
  then
    set criterion's name, maxPoints, and position from the inputs
    return criterion
  where criterion not in criteria
  then
    refuse CRITERION_NOT_FOUND "There is no such criterion."
removeCriterion(criterion: Criterion) : return (criterion: Criterion)
  where criterion in criteria
  then
    delete criterion
    return criterion
  where criterion not in criteria
  then
    refuse CRITERION_NOT_FOUND "There is no such criterion."
```

## Queries

```queries
_getItem (item: String) : optional (item: String, label: String, maxPoints: Number, status: String)
  answers the active GradeItem for the Item
  answers no row when none exists

_getItems () : many (item: String, label: String, maxPoints: Number)
  answers all active grade items in creation order
  answers no rows when none match

_getCriteria (item: String) : many (criterion: String, name: String, maxPoints: Number, position: Number)
  answers the item's criteria in position order
  answers no rows when none match

_getCriterion (criterion: String) : optional (item: String, name: String, maxPoints: Number)
  answers the Criterion and its owning Item
  answers no row when the Criterion does not exist
```
