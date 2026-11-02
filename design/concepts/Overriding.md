# Overriding

## Purpose

Let a person replace a computed result for one subject with a value of their
own and a reason, keeping the result it replaced, so the judgment stays
visible beside the computation it departs from.

Prevents: an override nobody can explain; an override that silently outlives
a change in what it replaced; two standing overrides for one subject.

## Principle

The course policy gives Leo a C. In the grading meeting Ana sets Leo's grade
to B with the reason "strong design work late in the term", and the C it
replaced is kept with it. Setting an override without a reason is refused.
The policy later changes and now gives Leo a C+; the override still stands,
and staff can see it replaced a C. Ravi sets Leo's grade again, to B+, and his
override replaces Ana's, with the C+ it now replaced. When the meeting decides
the policy's grade is right after all, Ravi clears the override; clearing it
again changes nothing.

## Types

```types
external Subject
  An application-owned identity naming what the override is for.

external Author
  An application-owned identity naming who set the override.

opaque Seq
  An ordered list of the values its argument names.

opaque OverrideEntry
  One standing override as a value: its subject, value, reason, replaced result, author, and time set.
```

## State

```state
a set of Overrides with
  a subject  Subject
  a value    String
  a reason   String
  a replaced String
  an author  Author
  a setAt    Date

Rule: at most one override has each subject.
Rule: a value and a reason are never blank.
Rule: replaced is the computed result standing when the override was set; Overriding records it but never computes it.
Rule: subjects are opaque identities; Overriding neither creates nor validates them.
```

## Actions

```actions
set (subject: Subject, value: String, reason: String, replaced: String, author: Author, at: Date) : returns (override: Override)
  where value and reason are not blank and no override has subject
  then
    add a new override with subject, value, reason, replaced, author, and setAt at
    returns override
  where value and reason are not blank and an override has subject
  then
    set that override's value, reason, replaced, author, and setAt from the inputs
    returns override
  where value is blank
  then
    refuses OVERRIDE_VALUE_REQUIRED "An override needs a value."
  where reason is blank
  then
    refuses OVERRIDE_REASON_REQUIRED "An override needs a reason."

clear (subject: Subject) : returns (subject: Subject)
  where true
  then
    delete the override with subject when one stands
    returns subject
```

## Queries

```queries
_override (subject: String) : optional (override: String, value: String, reason: String, replaced: String, author: String, setAt: Date)
  answers the subject's standing override
  answers no row when the subject has none

_overrides () : one (overrides: Seq<OverrideEntry>)
  answers every standing override as one sequence of `{ subject, value, reason, replaced, author, setAt }`, earliest set first
  answers an empty sequence when none stand
```
