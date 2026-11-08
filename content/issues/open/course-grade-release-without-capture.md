---
milestone: public-deployment
concepts:
  - Publishing
  - Snapshotting
---

# A course-grade release that publishes but never captures can't be cleared

## Current behavior

Releasing course grades publishes a `course-grades` edition, then captures
the release's value in a later step. The two steps aren't atomic. If the
capture never lands (the process is replaced mid-request, or a read in the
course-grade inputs fails), the edition stays open with no value. The open
release is counted only with its value, so Release tries to publish again and
is refused by the one-open-edition rule, Release again and Hide find nothing
to act on, and students read "No course grade released yet."

Until this is fixed, staff recover by closing the edition by hand:
`db['courseGradePublishing.editions'].updateOne({ material: "course-grades", open: true }, { $set: { open: false, closedAt: new Date() } })`,
then releasing again.

## Unresolved decision

Decide whether Release and Hide treat an open edition without a value as
closable, or whether the release writes its value before it publishes.

## Acceptance condition

An application test makes the capture fail after the publish, then releases
again and reads every student's new card.
