# Timing

## Purpose

Tell a caller the current moment, so a choice that needs a timestamp does not
invent one.

## Principle

Noor asks what time it is and learns that it is 10:30. When she asks later, she
learns the later moment rather than the earlier answer.

## Types

```types

```

## State

```state
a set of Moments
alias Moment for Moments

Rule: Timing stores no moment; a moment is the clock reading reported at the instant it is asked for.
```

## Actions

```actions
capture () : return (at: Date)
  where true
  then
    return at
```

## Queries

```queries
_now () : one (at: Date)
  answers the current application time as at
```
