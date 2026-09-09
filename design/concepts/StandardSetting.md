# StandardSetting

## Purpose

Let people articulate the distinctions by which performance will be judged,
consult those expectations, and clarify them without rewriting earlier standards.

Prevents: a stated level with no description; an earlier edition silently taking
on a later meaning; one editor overwriting another editor's clarification.

## Principle

Elena defines Argumentation, describing Deficient, Emergent, Competent, and Expert
performance. Maya consults the first edition before writing and sees that
Competent requires an explicit connection between evidence and the claim. Elena
clarifies Expert and issues a second edition, naming the first as the edition
she started from. Maya can still read the first edition. Another editor trying
to revise from the first edition now is refused and must read the new standard.
Defining a standard with an undescribed level or a script reference link is
refused. No action overwrites an issued edition.

## Types

```types

```

## State

```state
a set of Standards with
  a current Edition

a set of Editions with
  a Standard
  a number Number
  a name String
  a description String
  a deficient String
  an emergent String
  a competent String
  an expert String
  a referenceUrl String

Rule: editions are immutable; revising appends one and changes only which edition is current.
Rule: an edition's number is one more than the previous edition's number for its standard, starting at one.
Rule: a complete standard has nonblank name, description, and four level descriptions, each at most 10000 characters; its optional reference is empty or an absolute HTTP(S) URL of at most 2048 characters without credentials.
Rule: the reference is supplementary text; StandardSetting never fetches or captures its target.
```

## Actions

```actions
define(name: String, description: String, deficient: String, emergent: String, competent: String, expert: String, referenceUrl: String) : return (standard: Standard, edition: Edition)
  where the supplied standard is complete
  then
    create a standard and its first immutable edition with the supplied descriptions and reference
    make that edition current and return standard and edition
    return standard, edition
  where the supplied standard is not complete
  then
    refuse INVALID_STANDARD "Supply all descriptions and a safe optional reference link."

revise(standard: Standard, expectedEdition: Edition, name: String, description: String, deficient: String, emergent: String, competent: String, expert: String, referenceUrl: String) : return (standard: Standard, edition: Edition)
  where standard exists, expectedEdition is current, and the supplied standard is complete
  then
    append a new immutable edition and atomically make it current
    return standard, edition
  where standard does not exist
  then
    refuse STANDARD_NOT_FOUND "There is no such standard."
  where expectedEdition is not current
  then
    refuse STANDARD_CONFLICT "This standard changed. Reload before issuing an edition."
  where the supplied standard is not complete
  then
    refuse INVALID_STANDARD "Supply all descriptions and a safe optional reference link."
```

## Queries

```queries
_getStandards () : many (standard: String, edition: String, number: Number, name: String, description: String, deficient: String, emergent: String, competent: String, expert: String, referenceUrl: String)
  answers each standard's current complete edition, in name order

_getEdition (edition: String) : optional (standard: String, edition: String, number: Number, name: String, description: String, deficient: String, emergent: String, competent: String, expert: String, referenceUrl: String)
  answers the specified edition even after it is no longer current
```
