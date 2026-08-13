# Resolving

## Purpose

Mark at most one accepted answer for a question, including who accepted it and
when.

## Principle

Lena accepts Bo's answer to her question. When she later accepts another
answer, it replaces the first. Clearing the accepted answer succeeds once and
is refused when the question has no resolution.

## State

```state
a Resolved set of Questions with
  an answer    Answer
  a resolvedBy User
  a resolvedAt Date
```

## Actions

```actions
accept(question: Question, answer: Answer, by: User, at: Date) : return ()
  then
    add question to resolved with answer, resolvedBy by, and resolvedAt at, replacing any prior resolution
    return

clear(question: Question) : return ()
  where question in resolved
  then
    remove question from resolved
    return
  where question not in resolved
  then
    refuse RESOLUTION_NOT_FOUND "This question has no accepted answer."
```

## Queries

```queries
_isResolved (question: String) : one (resolved: Boolean)

_getResolution (question: String) : optional (answer: String, resolvedBy: String, resolvedAt: Date)

_getQuestionsAnswered (answer: String) : many (question: String)
```

### Notes

- `_isResolved (question)` answers exactly one row with `resolved`.
- `_getResolution (question)` answers at most one accepted answer with who
  accepted it and when.
- `_getQuestionsAnswered (answer)` answers every question currently resolved
  by that answer.
