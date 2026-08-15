# Resolving

## Purpose

Mark at most one accepted answer for a question, including who accepted it and
when.

## Principle

Lena accepts Bo's answer to her question. When she later accepts another
answer, it replaces the first. Clearing the accepted answer succeeds once and
is refused when the question has no resolution.

## Types

```types
external User
  An application-owned identity used in the user role.

external Question
  An application-owned identity used in the question role.

external Answer
  An application-owned identity used in the answer role.
```

## State

```state
a Resolved set of Questions with
  an answer    Answer
  a resolvedBy User
  a resolvedAt Date
```

## Actions

```actions
accept(question: Question, answer: Answer, by: User, at: Date) : return (resolution: Resolution)
  where true
  then
    add question to resolved with answer, resolvedBy by, and resolvedAt at, replacing any prior resolution
    return resolution
clear(question: Question) : return (question: Question)
  where question in resolved
  then
    remove question from resolved
    return question
  where question not in resolved
  then
    refuse RESOLUTION_NOT_FOUND "This question has no accepted answer."
```

## Queries

```queries
_isResolved (question: String) : one (resolved: Boolean)
  answers whether the Question has an accepted Answer

_getResolution (question: String) : optional (answer: String, resolvedBy: String, resolvedAt: Date)
  answers the Question's accepted Answer, who accepted it, and when
  answers no row when the Question is unresolved

_getQuestionsAnswered (answer: String) : many (question: String)
  answers every question currently resolved by that answer
  answers no rows when none match
```
