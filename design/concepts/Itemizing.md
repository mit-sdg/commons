# Itemizing

## Purpose

Describe an item's assessment structure as ordered criteria referring to stable
external bases, preserving each criterion's meaning after it leaves the active list.

## Principle

Elena configures the paper and adds Argumentation edition one as its first basis.
She moves it later in the list. Adding the same basis twice is refused. She removes
that criterion from future use and adds edition two. The original criterion still
answers which basis it used. Archiving the item hides it from active item lists;
adding a criterion to an archived or unknown item is refused. Ensuring an existing
item does not overwrite its chosen label or reactivate it.

## Types

```types
external Item
  The application-owned thing whose assessment structure is described.
external Basis
  An opaque external standard interpreted by the application.
```

## State

```state
a set of GradeItems with
  an item Item
  a label String

a Active set of GradeItems
an Archived set of GradeItems

a set of Criteria with
  an item Item
  a basis Basis
  a position Number

a Selected set of Criteria

Rule: each item has at most one grade item; configuration can reactivate it.
Rule: a criterion's item and basis never change; removing it only removes it from Selected.
Rule: selected criteria of one item have distinct bases and nonnegative integer positions.
```

## Actions

```actions
configureItem(item: Item, label: String) : return (gradeItem: GradeItem)
  where true
  then
    create or reactivate the item's grade item, set its label, preserve criteria, and return gradeItem
    return gradeItem

ensureItem(item: Item, label: String) : return (gradeItem: GradeItem)
  where true
  then
    return gradeItem

archiveItem(item: Item) : return (gradeItem: GradeItem)
  where the item has an active grade item
  then
    move it to Archived and return gradeItem
    return gradeItem
  where the item has no active grade item
  then
    refuse GRADE_ITEM_NOT_FOUND "There is no active item."

addCriterion(item: Item, basis: Basis, position: Number) : return (criterion: Criterion)
  where the item is active, basis is not selected, and position is a nonnegative integer
  then
    create a criterion with item, basis, and position, add it to Selected, and return criterion
    return criterion
  where the item is not active
  then
    refuse GRADE_ITEM_NOT_FOUND "There is no active item."
  where the basis is already selected or the position is invalid
  then
    refuse INVALID_CRITERION "Select a distinct basis and a nonnegative integer position."

reviseCriterion(criterion: Criterion, position: Number) : return (criterion: Criterion)
  where criterion is selected for an active item and position is a nonnegative integer
  then
    change only its position and return criterion
    return criterion
  where criterion is not selected for an active item
  then
    refuse CRITERION_NOT_FOUND "There is no active criterion."
  where position is invalid
  then
    refuse INVALID_CRITERION "Use a nonnegative integer position."

removeCriterion(criterion: Criterion) : return (criterion: Criterion)
  where criterion is selected for an active item
  then
    remove criterion from Selected without deleting its identity or basis and return criterion
    return criterion
  where criterion is not selected for an active item
  then
    refuse CRITERION_NOT_FOUND "There is no active criterion."
```

## Queries

```queries
_getSelection (item: String) : optional (criteria: Json)
  answers one complete ordered selection of criterion identities for an active item

_getItem (item: String) : optional (item: String, label: String, status: String)
  answers the item's label and active or archived status, including for historical readers
_getItems () : many (item: String, label: String)
  answers active items in label order
_getCriteria (item: String) : many (criterion: String, basis: String, position: Number)
  answers selected criteria in position order
_getCriterion (criterion: String) : optional (item: String, basis: String, position: Number, active: Bool)
  answers the immutable basis even when the criterion is no longer selected
```
