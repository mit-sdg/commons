# Snapshotting

## Purpose

Preserve the exact value released for a subject, once, so later work on its
source cannot rewrite what that subject already represents.

## Principle

Professor Lee launches a reviewed quiz. Its run captures the complete
presentation the room received. She may revise the questionnaire for a later
class after this run closes, but this run's questions, board, and receipts
keep the captured value. Attempting to capture the run again is refused rather
than silently replacing its history.

## Types

```types
external Subject
  An application-owned identity naming what the snapshot belongs to.

external Value
  An application-owned structured value preserved without interpretation.
```

## State

```state
a set of Snapshots with
  a subject Subject
  a value   Value

Rule: at most one snapshot has each subject.
Rule: a snapshot's subject and value never change after capture.
Rule: Snapshotting preserves a value but does not produce, validate, reveal, or interpret it; those decisions belong to the surrounding design.
```

## Actions

```actions
capture (subject: Subject, value: Value) : return (snapshot: Snapshot)
  where no snapshot has subject subject
  then
    add a new snapshot with subject and value
    return snapshot
  where a snapshot has subject subject
  then
    refuse SNAPSHOT_EXISTS "This subject already has a snapshot."
```

## Queries

```queries
_snapshot (subject: String) : optional (snapshot: String, value: Value)
  answers the subject's snapshot
  answers no row when the subject has no snapshot
```
