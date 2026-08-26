# Scoring

## Purpose

Let a result be worth trusting: the standard exists whole before anyone is
measured, everyone meets the same one, and what a participant learns afterward
is exactly what the standard's author chose to share.

## Principle

When Professor Lee's quiz goes live, a key is established from her reviewed
answers in one act — every expectation together, along with her choice that
participants will see their score and the expected answers. Leon's submitted
response is graded against it: four out of five, and he sees which answers were
expected but not the explanations she kept back. Everyone who submits is
measured against the same key, because the key has no way to change once it
exists. Her survey, having no key, produces no results at all, and grading the
same submission twice is refused.

## Types

```types
external Subject
  An application-owned identity a key measures responses to.

external Item
  An application-owned identity a single expectation addresses.

external Submission
  An application-owned identity for one measured hand-in.
```

## State

```state
a set of Keys with
  a subject    Subject
  a disclosure String

a set of Expectations with
  a key      Key
  an item    Item
  an expected String
  an explanation String

a set of Results with
  a key        Key
  a submission Submission
  a score      Number

Rule: a named level is a calculation over the input alone: a disclosure names a level when it is `score`, `answers`, or `explanations`, each revealing everything the previous level does.
Rule: whether an expected answer matches a given one is exact string equality, calculated over the inputs alone.
Rule: a key's expectations arrive whole at establishment and never change, so no participant is ever measured against a standard that moved.
Rule: an empty explanation carries none, the way an omitted field does.
Rule: each entry of establish's expectations is `{ item, expected, explanation }`, and each entry of grade's answers is `{ item, value }` — a submission's answers reach grade as one collected value.
Rule: Scoring records what may be revealed but does not render outcomes or police screens; whether a participant's view honors a key's disclosure is the composition's obligation, read directly from the key, and establish takes only material an author already reviewed.
Rule: a result's score counts the key's expectations matched by an answer of the same item; answers to items the key does not expect count nothing, and the denominator is read from the key's expectations rather than stored.
```

## Actions

```actions
establish (subject: Subject, disclosure: String, expectations: Seq) : return (key: Key)
  where no key has subject subject and disclosure names a level
  then
    add a new key with subject and disclosure
    add a new expectation for each entry of expectations with its item, expected, and explanation
    return key
  where a key has subject subject
  then
    refuse KEY_EXISTS "This already has a key."
  where disclosure does not name a level
  then
    refuse UNKNOWN_DISCLOSURE "That is not a disclosure level."

grade (key: Key, submission: Submission, answers: Seq) : return (result: Result, score: Number)
  where key exists and submission has no result for key
  then
    add a new result with key and submission, whose score counts the key's
      expectations matched by an answer of the same item
    return result, score
  where key does not exist
  then
    refuse KEY_NOT_FOUND "There is no such key."
  where submission has a result for key
  then
    refuse ALREADY_GRADED "This submission was already graded."
```

## Queries

```queries
_keyFor (subject: String) : optional (key: String, disclosure: String)
  answers the subject's key
  answers no row when none exists

_key (key: String) : optional (subject: String, disclosure: String)
  answers the complete Key
  answers no row when the Key does not exist

_expectations (key: String) : many (item: String, expected: String, explanation: String)
  answers the key's expectations in establishment order
  answers no rows when none match

_resultFor (key: String, submission: String) : optional (result: String, score: Number, outOf: Number)
  answers the submission's result with the score and the count of the key's expectations
  answers no row when none exists

_results (key: String) : many (result: String, submission: String, score: Number, outOf: Number)
  answers the key's results in grading order
  answers no rows when none match
```
