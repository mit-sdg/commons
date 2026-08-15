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
the current Moment
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
