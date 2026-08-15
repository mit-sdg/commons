# Banking

## Purpose

Give each learner a visible allowance of late days that staff can increase and
the learner can apply to individual items of work.

## Principle

The course gives every learner three late days and limits each item to two. Ana
applies two days to an essay. She cannot apply two more to a problem set because
only one remains. Her advisor grants two extra days for conference travel, so
the second use succeeds. Ana later cancels that use. Its days return to her
balance, while the canceled use remains recorded.

## Types

```types
external Learner
  An application-owned identity used in the learner role.

external Item
  An application-owned identity used in the item role.
```

## State

```state
an optional Terms with
  an allowance    Number
  a perItemLimit  Number
  a unitHours     Number

a set of Grants with
  a learner   Learner
  a days      Number
  a reason    String
  a grantedAt Date

a set of Uses with
  a learner   Learner
  an item     Item
  a days      Number
  an appliedAt Date

an Applied  set of Uses
a Canceled  set of Uses
```

Until terms are set, the allowance is zero, the per-item limit is five days,
and each late day represents twenty-four hours. Banking records `unitHours` but
does not use it when applying days.

A learner's balance is:

`remaining = allowance + granted days - days in applied uses`

Canceled uses are retained but excluded from the equation. A learner has at
most one applied use per item.

A use may be changed to zero days. It remains applied but spends nothing.
Canceling retains the use with a canceled status.

Items are opaque identities. Banking neither creates nor validates them; it
records only the learner's standing late-day use of each identity.

## Actions

```actions
setTerms(allowance: Number, perItemLimit: Number, unitHours: Number) : return (allowance: Number, perItemLimit: Number, unitHours: Number)
  where true
  then
    set the terms' allowance, perItemLimit, and unitHours from the inputs
    return allowance, perItemLimit, unitHours
grant(learner: Learner, days: Number, reason: String, at: Date) : return (grant: Grant)
  where days is greater than zero
  then
    add a new grant with learner, days, and reason
    set grant's grantedAt to at
    return grant
  where days is not greater than zero
  then
    refuse LATE_DAYS_MUST_BE_POSITIVE "A grant must be for a positive number of days."

apply(learner: Learner, item: Item, days: Number, at: Date) : return (use: Use)
  where days is greater than zero, days is at most the terms' perItemLimit, learner has no applied use for item, and days is at most the balance of learner
  then
    add a new use with learner, item, and days
    set use's appliedAt to at
    add use to applied
    return use
  where days is not greater than zero
  then
    refuse LATE_DAYS_MUST_BE_POSITIVE "Late days must be a positive number."
  where days is greater than the terms' perItemLimit
  then
    refuse LATE_DAYS_EXCEED_MAX "That is more late days than any one item may absorb."
  where learner has an applied use for item
  then
    refuse LATE_USE_ALREADY_EXISTS "Late days already stand applied to this item."
  where days is greater than the balance of learner
  then
    refuse INSUFFICIENT_BALANCE "The learner's balance is short of the days requested."

change(learner: Learner, item: Item, days: Number) : return (use: Use)
  where the applied use of learner and item stands, days is at least zero, days is at most the terms' perItemLimit, and the increase over the use's days is at most the balance of learner
  then
    set use's days to days
    return use
  where learner has no applied use for item
  then
    refuse LATE_USE_NOT_FOUND "No late days stand applied to this item."
  where days is less than zero
  then
    refuse LATE_DAYS_NEGATIVE "Late days cannot be negative."
  where days is greater than the terms' perItemLimit
  then
    refuse LATE_DAYS_EXCEED_MAX "That is more late days than any one item may absorb."
  where the increase over the use's days is greater than the balance of learner
  then
    refuse INSUFFICIENT_BALANCE "The learner's balance is short of the increase requested."

cancel(learner: Learner, item: Item) : return (use: Use)
  where the applied use of learner and item stands
  then
    remove use from applied
    add use to canceled
    return use
  where learner has no applied use for item
  then
    refuse LATE_USE_NOT_FOUND "No late days stand applied to this item."
```

## Queries

```queries
_getTerms () : one (allowance: Number, perItemLimit: Number, unitHours: Number)
  answers exactly one row with the stated or default terms

_getBalance (learner: String) : one (granted: Number, used: Number, remaining: Number)
  answers exactly one row. `granted` is the allowance plus grant days, `used` is the sum of applied uses, and `remaining` is `granted - used`

_getApplied (learner: String, item: String) : optional (use: String, days: Number, appliedAt: Date)
  answers the Learner's standing Use for the Item
  answers no row when no standing Use exists

_getUses (learner: String) : many (use: String, item: String, days: Number, status: String, appliedAt: Date)
  answers all of the learner's uses in creation order, including canceled uses
  answers no rows when none match

_getUsesForItem (item: String) : many (learner: String, days: Number)
  answers the standing uses on the item in creation order
  answers no rows when none match

_getGrants (learner: String) : many (grant: String, days: Number, reason: String, grantedAt: Date)
  answers the learner's grants in creation order
  answers no rows when none match
```
