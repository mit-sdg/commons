# Itemizing

## Purpose

Own an item's current grading method and ordered criteria as one revisioned setup,
while retaining retired criterion identities for safe editing and migration.

## Principle

Elena configures a paper for competency grading and atomically saves two rubric
editions in order. Another editor cannot overwrite that setup from an older
revision. Elena later replaces the current setup with two named point criteria.
Existing assessments are unaffected because Grading already captured their full
definitions. New criteria receive server identities; retained identities cannot
be moved between items or rebound to another rubric edition.

## Types

```types
external Item
  The application-owned thing whose assessment structure is described.
external Basis
  An opaque immutable rubric edition interpreted by the application.
Method is COMPETENCY or POINTS
  How an item is assessed, and how each criterion is rated: by competency or by points.
opaque CriteriaSetup
  The selected criteria as one setup document lists them, in position order.
```

## State

```state
a set of GradeItems with
  an item Item
  a label String
  a method Method
  a revision Number

a set of Active GradeItems
a set of Archived GradeItems

a set of Criteria with
  an item Item
  a kind Method
  a position Number
  an optional basis Basis
  an optional name String
  an optional maxPoints Number

a set of Selected Criteria

Rule: each item has at most one grade item; a new item is competency graded at revision zero with no selected criteria.
Rule: a setup mutation compares the observed revision, atomically replaces method and Selected Criteria, and increments revision once.
Rule: an identical whole-setup save is idempotent and does not increment revision.
Rule: selected criteria match the method and have distinct identities and nonnegative integer positions.
Rule: selected competency criteria have distinct nonblank bases; an existing competency identity cannot change basis.
Rule: points setup has at least one criterion; every point name is nonblank and every individual and derived maximum is positive and finite.
Rule: missing criterion identities are allocated by the server; supplied identities must already belong to the item and kind.
Rule: removing a criterion only removes it from Selected Criteria; its identity and immutable fields remain owned by the item.
Rule: archiving prevents setup mutation; ensuring an item does not overwrite or reactivate it.
```

## Actions

```actions
configureItem(item: Item, label: String) : returns (gradeItem: GradeItem)
  where true
  then
    create or reactivate the item's grade item, set its label, preserve setup, and return gradeItem
    returns gradeItem

ensureItem(item: Item, label: String) : returns (gradeItem: GradeItem)
  where true
  then
    create a missing default item, otherwise preserve every field, and return gradeItem
    returns gradeItem

archiveItem(item: Item) : returns (gradeItem: GradeItem)
  where the item is active
  then
    move it to Archived GradeItems and return gradeItem
    returns gradeItem
  where the item is not active
  then
    refuses GRADE_ITEM_NOT_FOUND "There is no active item."

configureSetup(item: Item, method: String, revision: Number, criteria: CriteriaSetup, resolvedCriteria: CriteriaSetup) : returns (gradeItem: GradeItem, label: String, status: String, method: String, revision: Number, criteria: CriteriaSetup, maxPoints: Number)
  where item is active, revision is current, and the complete setup is valid and different
  then
    allocate missing criterion identities, atomically replace method and Selected Criteria, increment revision, and return the new revision
    returns gradeItem, label, status, method, revision, criteria, maxPoints
  where item is active, revision is current, and the normalized setup is unchanged
  then
    preserve setup and return the current revision
    returns gradeItem, label, status, method, revision, criteria, maxPoints
  where item is not active
  then
    refuses GRADE_ITEM_NOT_FOUND "There is no active item."
  where revision is not current
  then
    refuses GRADE_ITEM_CONFLICT "This grading setup changed. Reload before saving."
  where setup is invalid
  then
    refuses INVALID_CRITERION "Supply a valid complete grading setup."

addCriterion(item: Item, basis: Basis, position: Number, revision: Number) : returns (criterion: Criterion, revision: Number)
  where a competency item is active, revision is current, and basis and position are valid
  then
    add a new selected competency criterion through one setup replacement
    returns criterion, revision
  where the conditions do not hold
  then
    refuses INVALID_CRITERION "Select a distinct rubric edition and valid position."

reviseCriterion(criterion: Criterion, position: Number, revision: Number) : returns (criterion: Criterion, revision: Number)
  where criterion is a selected competency criterion and revision and position are valid
  then
    change only its position through one setup replacement
    returns criterion, revision
  where criterion is not selected
  then
    refuses CRITERION_NOT_FOUND "There is no active competency criterion."

addPointCriterion(item: Item, name: String, maxPoints: Number, position: Number, revision: Number) : returns (criterion: Criterion, revision: Number)
  where a points item is active, revision is current, and name, maximum, and position are valid
  then
    add a new selected point criterion through one setup replacement
    returns criterion, revision
  where the conditions do not hold
  then
    refuses INVALID_CRITERION "Supply a valid point criterion."

revisePointCriterion(criterion: Criterion, name: String, maxPoints: Number, position: Number, revision: Number) : returns (criterion: Criterion, revision: Number)
  where criterion is a selected point criterion and revision, name, maximum, and position are valid
  then
    replace its editable definition through one setup replacement
    returns criterion, revision
  where criterion is not selected
  then
    refuses CRITERION_NOT_FOUND "There is no active point criterion."

removeCriterion(criterion: Criterion, revision: Number) : returns (criterion: Criterion, revision: Number)
  where criterion is selected for an active item and revision is current and the resulting setup is valid
  then
    retire it through one setup replacement and return the new revision
    returns criterion, revision
  where criterion is not selected
  then
    refuses CRITERION_NOT_FOUND "There is no active criterion."
```

## Queries

```queries
_getItem (item: String) : optional (item: String, label: String, status: String, method: String, revision: Number, maxPoints: Number)
  answers identity, lifecycle status, and current setup summary, including archived items
_getItems () : many (item: String, label: String, method: String, revision: Number, maxPoints: Number)
  answers active items and current setup summaries in label order
_getSetup (item: String) : optional (item: String, label: String, status: String, method: String, revision: Number, criteria: CriteriaSetup, maxPoints: Number)
  answers one coherent current setup document with selected criteria in position order
```
