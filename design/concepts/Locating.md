# Locating

## Purpose

Give a subject one durable, short code by which it can be found, without making
that code a credential or asking the subject to own its presentation.

## Principle

Professor Lee ensures that today's quiz run has a location and receives the
six-character code `7KMP2Q`. Ensuring it again returns the same code. A student
may type `7kmp2q` with surrounding spaces and still locate the same run. A
malformed or unknown code reveals nothing and receives the same refusal.

## Types

```types
external Subject
  An application-owned identity a code locates.
```

## State

```state
a set of Locations with
  a subject Subject
  a code    String

Rule: at most one location may hold each subject, and ensuring a located subject preserves its code.
Rule: codes are unique among locations and contain exactly six characters from ABCDEFGHJKLMNPQRSTUVWXYZ23456789.
Rule: locations are durable; Locating has no action that rotates, expires, or removes one.
Rule: a code is a convenient locator, not a secret or a credential.
Rule: Locating does not render codes, decide who may see one, or interpret the subject's own state.
```

## Actions

```actions
ensure (subject: Subject) : return (location: Location, code: String)
  where a location has subject subject
  then
    return location, code
  where no location has subject subject
  then
    add a location with subject and a freshly minted unique code
    return location, code

locate (code: String) : return (subject: Subject)
  where trimming code and changing letters to uppercase yields the code of a location
  then
    return subject
  where it does not yield the code of a location
  then
    refuse NOTHING_LOCATED "Nothing is located there."
```

## Queries

```queries
_for (subject: String) : optional (location: String, code: String)
  answers the location and code that locate the subject
  answers no row when the subject has no location

_at (code: String) : optional (location: String, subject: String)
  trims code and changes letters to uppercase before answering
  answers the location and subject at that code
  answers no row when the code is malformed or unknown
```
