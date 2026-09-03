# Suggesting

## Purpose

Let a helper put forward **suggestions** about someone's **work**, each taken or declined on its own by the person the work belongs to — so help never changes anything unasked, and one bad idea never spoils the good ones beside it.

Prevents: a change landing that nobody chose; a good suggestion thrown out with a bad one it arrived with.

## Principle

A reader of Noor's draft _offers_ four suggestions about it at once: two rewordings, a cut, and a new heading. Noor _takes_ the first rewording and the heading, each on its own; the draft changes only where she said so. She _declines_ the cut, and it stays on record as declined rather than disappearing. Later she comes back to take the cut after all and is refused, because she already settled it — a suggestion is answered once. A second reader offers three more; Noor takes them all, one at a time, and every one is applied.

## Types

```types
external Subject
  An application-owned identity naming the work the suggestions are about.
```

## State

```state
a set of Offerings with
  a subject    Subject
  an offeredAt Date

a set of Suggestions with
  an offering  Offering
  a kind       String
  a target     String
  a value      String
  a position   Number

a Pending  set of Suggestions
a Taken    set of Suggestions
a Declined set of Suggestions

Rule: each entry of offer's lines is `{ kind, target, value }`; a kind is a nonblank string, and target and value are strings that may be empty; the suggestions keep the lines' order under per-suggestion identities the concept mints.
Rule: an offering carries at least one line.
Rule: a suggestion is in exactly one of pending, taken, or declined, and leaves pending exactly once.
Rule: Suggesting does not produce suggestions, interpret what a kind, target, or value means, or apply a taken suggestion to the work; what taking one changes is arranged outside the concept.
```

## Actions

```actions
offer (subject: Subject, lines: Seq, at: Date) : return (offering: Offering)
  where lines has at least one entry and every entry names a nonblank kind
  then
    add a new offering with subject and offeredAt at
    add a new suggestion for each entry of lines with its kind, target, and value, in order, and add it to pending
    return offering
  where lines is empty
  then
    refuse NOTHING_OFFERED "An offering needs at least one suggestion."
  where some entry of lines names no kind
  then
    refuse INVALID_SUGGESTION "Every suggestion needs a kind."

take (suggestion: Suggestion) : return (suggestion: Suggestion, offering: Offering, kind: String, target: String, value: String)
  where suggestion in pending
  then
    remove suggestion from pending
    add suggestion to taken
    return suggestion, offering, kind, target, value
  where suggestion does not exist
  then
    refuse SUGGESTION_NOT_FOUND "There is no such suggestion."
  where suggestion not in pending
  then
    refuse SUGGESTION_SETTLED "This suggestion was already settled."

decline (suggestion: Suggestion) : return (suggestion: Suggestion)
  where suggestion in pending
  then
    remove suggestion from pending
    add suggestion to declined
    return suggestion
  where suggestion does not exist
  then
    refuse SUGGESTION_NOT_FOUND "There is no such suggestion."
  where suggestion not in pending
  then
    refuse SUGGESTION_SETTLED "This suggestion was already settled."
```

## Queries

```queries
_offering (offering: String) : optional (subject: String, offeredAt: Date)
  answers the complete Offering
  answers no row when the Offering does not exist

_offeringsAbout (subject: String) : many (offering: String, offeredAt: Date)
  answers the subject's offerings, newest first
  answers no rows when none match

_suggestions (offering: String) : many (suggestion: String, kind: String, target: String, value: String, position: Number, standing: String)
  answers the offering's suggestions in position order, each standing `pending`, `taken`, or `declined`
  answers no rows when none match

_pendingIn (offering: String) : many (suggestion: String, kind: String, target: String, value: String, position: Number)
  answers the offering's suggestions still pending, in position order
  answers no rows when none match

_suggestion (suggestion: String) : optional (offering: String, subject: String, kind: String, target: String, value: String, position: Number, standing: String)
  answers the complete Suggestion with its offering's subject
  answers no row when the Suggestion does not exist
```
