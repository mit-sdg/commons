# Delegating

## Purpose

Name, for one item, at most one delegate answerable for each subject, so work can
be split before it starts, and atomically spread a batch of subjects evenly over
chosen delegates.

## Principle

Mara makes herself answerable for Priya's problem set, then hands the same
subject to Noah; Priya still has exactly one delegate, now Noah. Withdrawing that
delegation succeeds once and is refused the second time. Mara later spreads four
more students over herself and Noah: the count each already holds on that problem
set decides who takes the next student, and a tie goes to the delegate named
earlier. Re-spreading students replaces their current delegates without counting
those soon-to-be-replaced delegations. The entire spread changes together, so no
reader can observe only part of it. Empty or repeated selections are refused.

## Types

```types
external Item
  An application-owned identity used in the item role.

external Subject
  An application-owned identity used in the subject role.

external Delegate
  An application-owned identity used in the delegate role.
```

## State

```state
a set of Delegations with
  an item      Item
  a subject    Subject
  a delegate   Delegate

Rule: an item has at most one delegation for a given subject.
Rule: one spread is one atomic state change: every subject it selects receives its computed delegate, or none do.
Rule: a spread that does not replace standing delegations selects only named subjects with no delegate at the moment the atomic change is decided; a replacing spread selects every named subject.
Rule: a spread counts the delegations an item already holds, except the ones held by the subjects being spread.
Rule: a spread reads subjects in their supplied order and chooses the listed delegate holding the fewest counted subjects, resolving a tie in favor of the delegate named earlier.
Rule: items, subjects, and delegates are opaque identities; Delegating neither creates nor validates them.
```

## Actions

```actions
delegate(item: Item, subject: Subject, delegate: Delegate) : return (delegation: Delegation)
  where no delegation has this item and subject
  then
    add a new delegation with item, subject, and delegate
    return delegation
  where some delegation has this item and subject
  then
    replace that delegation's delegate with delegate
    return delegation

withdraw(item: Item, subject: Subject) : return (delegation: Delegation)
  where some delegation has this item and subject
  then
    delete that delegation
    return delegation
  where no delegation has this item and subject
  then
    refuse DELEGATION_NOT_FOUND "No delegate is named for this subject."

spread(item: Item, subjects: Seq, delegates: Seq, replace: Bool) : return (assigned: Rows)
  where subjects and delegates each hold at least one member and neither names a member twice
  then
    when replace is false, select only named subjects with no current delegation
    when replace is true, select every named subject
    count for each listed delegate the subjects it holds on item, excluding the listed subjects
    for each selected subject in the order given:
      take the listed delegate with the smallest count, earliest in the given list on a tie
      replace or add that item and subject's delegation with that delegate
      raise that delegate's count by one
    atomically store every resulting delegation
    collect one subject and delegate row for each selected subject in the order given as assigned
    return assigned
  where subjects is empty, delegates is empty, either names a member twice, or replace is not a Bool
  then
    refuse INVALID_SPREAD "Choose at least one subject and at least one delegate, each named once."

clearItem(item: Item) : return (cleared: Number)
  where true
  then
    take how many delegations of item there are as cleared
    delete every delegation of item atomically
    return cleared
```

## Queries

```queries
_getDelegations (item: String) : many (delegation: String, subject: String, delegate: String)
  answers the item's delegations in the order they were first made
  answers no rows when none match

_getDelegation (item: String, subject: String) : optional (delegation: String, delegate: String)
  answers the delegation naming who is answerable for the Subject on the Item
  answers no row when the Subject has no delegate on the Item
```
