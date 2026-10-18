# Submitting

## Purpose

Let a learner submit numbered attempts for an assignment and withdraw or
restore each attempt.

## Principle

Maya submits an essay as attempt one, withdraws it, and submits a revision as
attempt two. Withdrawal does not reuse the first number. Withdrawing the first
attempt again is refused. Restoring it succeeds, so both attempts are submitted.

## Types

```types
external Submitter
  An application-owned identity used in the submitter role.

external Assignment
  An application-owned identity used in the assignment role.

external Artifact
  An application-owned identity used in the artifact role.
opaque Seq
  An ordered list of the values its argument names.
```

## State

```state
a set of Submissions with
  an Assignment
  a submitter   Submitter
  a number      Number
  an artifacts set of Artifacts
  a submittedAt Date

a set of Submitted Submissions
a set of Withdrawn Submissions

Rule: number reservation survives a failed insert; gaps can occur after failure, but an allocated number is never reused.
Rule: a submitter's attempts on an assignment are numbered from one, and a number, once used, is never reused; withdrawing an attempt does not free its slot.
```

## Actions

```actions
submit(assignment: Assignment, submitter: Submitter, artifact: Artifact, at: Date) : returns (submission: Submission)
  where true
  then
    add a new submission with assignment and submitter, its artifacts holding artifact
    reserve the next attempt number atomically for this submitter and assignment, above all previously reserved or stored numbers, starting at 1
    set submission's submittedAt to at
    add submission to submitted
    returns submission

withdraw(submission: Submission) : returns (submission: Submission)
  where submission in submitted
  then
    remove submission from submitted
    add submission to withdrawn
    returns submission
  where submission not in submissions
  then
    refuses SUBMISSION_NOT_FOUND "There is no such submission."
  where submission in withdrawn
  then
    refuses SUBMISSION_NOT_SUBMITTED "Only a submitted attempt can be withdrawn."
restore(submission: Submission) : returns (submission: Submission)
  where submission in withdrawn
  then
    remove submission from withdrawn
    add submission to submitted
    returns submission
  where submission not in submissions
  then
    refuses SUBMISSION_NOT_FOUND "There is no such submission."
  where submission in submitted
  then
    refuses SUBMISSION_NOT_WITHDRAWN "Only a withdrawn attempt can be restored."
```

## Queries

```queries
_getLatest (assignment: String, submitter: String) : optional (latest: Submission)
  answers the Submitter's highest-numbered submitted attempt for the Assignment
  answers no row when there is no submitted attempt

_getAttempts (assignment: String, submitter: String) : many (submission: String, artifacts: Seq<String>, submittedAt: Date, number: Number, status: String)
  answers all attempts in number order
  answers no rows when none match

_getSubmissionsForAssignment (assignment: String) : many (submitter: String, submission: String, artifacts: Artifacts, submittedAt: Date, number: Number, status: String)
  answers its attempts and artifact identities in creation order
  answers no rows when none match

_getSubmissionsForSubmitter (submitter: String) : many (assignment: String, submission: String, submittedAt: Date, number: Number, status: String)
  answers the learner's attempts in creation order
  answers no rows when none match
```
