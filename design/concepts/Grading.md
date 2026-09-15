# Grading

## Purpose

Assess one learner's particular evidence against an immutable grading setup,
then release, retract, excuse, and correct that assessment without rewriting its
meaning or losing prior releases.

## Principle

Elena starts Maya's first paper assessment while the paper has two competency
criteria. The assessment permanently captures those rubric editions. Elena
releases it, retracts it for correction, and releases a second revision; both
releases remain. Maya's second attempt is a separate assessment. For another
paper Elena captures two point criteria, including an entered zero. Changing the
current paper setup later affects only assessments that have not yet started, so
an 8 out of 10 assessment remains 8 out of 10 and can still be corrected.

## Types

```types
external Grader
  The identity acting as assessor.
external Learner
  The identity whose work is assessed.
external Item
  The activity under assessment.
external Evidence
  The particular work under assessment, or the application's empty-evidence marker for an assignment-wide excusal.
```

## State

```state
a set of Grades with
  a learner Learner
  an item Item
  an evidence Evidence
  a grader Grader
  a method of COMPETENCY or POINTS
  a setupRevision Number
  a criteria Json
  a judgments Json
  a feedback String
  a version Number
  a createdAt Date
  an updatedAt Date
  an optional releasedAt Date
  a history Json

a Draft set of Grades
a Released set of Grades
an Excused set of Grades

Rule: at most one grade has a given learner, item, and evidence; repeated creation returns it unchanged.
Rule: a grade's learner, item, evidence, method, setup revision, and complete criterion definitions never change.
Rule: competency criterion snapshots retain their rubric edition identity, label, standard metadata, and every level description; point criterion snapshots retain name, maximum, and order.
Rule: there are at most 100 criteria with distinct identities and positions; nonempty evidence requires at least one criterion.
Rule: judgments match the stored method and criteria and contain at most one entry per criterion.
Rule: competency ratings are DEFICIENT, EMERGENT, COMPETENT, EXPERT, or NOT_ASSESSED and judgment feedback is at most 20000 characters.
Rule: a point judgment has a finite score from zero through its criterion maximum; absence is unscored while numeric zero is scored.
Rule: every point maximum and the derived score and maximum totals are positive or nonnegative as applicable and finite.
Rule: assessment feedback is at most 20000 characters.
Rule: every mutation compares the supplied version and required status atomically and increments version on success.
Rule: release requires nonempty evidence and one valid disposition for every stored criterion.
Rule: release and excusal append immutable history; retracting and restoring never erase history or the private draft judgments.
Rule: exposed excused grades omit private judgments and scored values while retaining the denominator and excusal feedback.
```

## Actions

```actions
record(learner: Learner, item: Item, evidence: Evidence, grader: Grader, method: String, setupRevision: Number, criteria: Json, at: Date) : return (grade: Grade, version: Number, method: String)
  where a grade already has learner, item, and evidence
  then
    preserve that grade without validating the supplied current setup
    return grade, version, method
  where no grade has learner, item, and evidence and method, setup revision, and the complete criterion snapshot are valid
  then
    create one draft fixing learner, item, evidence, method, setup revision, and criteria, with version one and no judgments
    return grade, version, method
  where the setup snapshot is invalid
  then
    refuse INVALID_JUDGMENTS "Select a valid complete grading setup."

save(grade: Grade, version: Number, grader: Grader, judgments: Json, feedback: String, at: Date) : return (grade: Grade, version: Number)
  where grade is draft at version and judgments and feedback match its stored method and criteria
  then
    atomically replace judgments and feedback, record grader and time, and increment version
    return grade, version
  where grade does not exist
  then
    refuse GRADE_NOT_FOUND "There is no assessment."
  where grade is not draft at version
  then
    refuse GRADE_CONFLICT "This assessment changed or is locked. Reload before editing."
  where judgments or feedback are invalid
  then
    refuse INVALID_JUDGMENTS "Use valid judgments for the stored criteria."

release(grade: Grade, version: Number, grader: Grader, at: Date) : return (grade: Grade, version: Number)
  where grade is a complete draft at version
  then
    append an immutable release, mark grade released, record grader and time, and increment version
    return grade, version
  where grade does not exist
  then
    refuse GRADE_NOT_FOUND "There is no assessment."
  where grade is not draft at version
  then
    refuse GRADE_CONFLICT "This assessment changed or is locked. Reload before editing."
  where grade is incomplete
  then
    refuse GRADE_INCOMPLETE "Complete every criterion before release."

releaseItem(item: Item, grader: Grader, at: Date) : return (released: Json, skipped: Json, unconfirmed: Json)
  where true
  then
    attempt release of every draft on item at its observed version, retaining successes, reporting incomplete or changed drafts as skipped, and reporting unexpected write outcomes as unconfirmed
    return released, skipped, unconfirmed

retract(grade: Grade, version: Number, grader: Grader, at: Date) : return (grade: Grade, version: Number)
  where grade is released at version
  then
    move it to draft, clear releasedAt, retain history, record grader and time, and increment version
    return grade, version
  where grade does not exist
  then
    refuse GRADE_NOT_FOUND "There is no assessment."
  where grade is not released at version
  then
    refuse GRADE_CONFLICT "This assessment changed or is locked. Reload before editing."

restoreExcused(grade: Grade, version: Number, grader: Grader, at: Date) : return (grade: Grade, version: Number)
  where grade is excused at version
  then
    move it to draft, clear releasedAt, retain history and private draft values, record grader and time, and increment version
    return grade, version
  where grade does not exist
  then
    refuse GRADE_NOT_FOUND "There is no assessment."
  where grade is not excused at version
  then
    refuse GRADE_CONFLICT "This assessment changed or is locked. Reload before editing."

excuse(grade: Grade, version: Number, grader: Grader, feedback: String, at: Date) : return (grade: Grade, version: Number)
  where grade is draft at version and feedback is valid
  then
    append an excusal release, mark grade excused without erasing private draft judgments, record grader and time, and increment version
    return grade, version
  where grade does not exist
  then
    refuse GRADE_NOT_FOUND "There is no assessment."
  where grade is not draft at version
  then
    refuse GRADE_CONFLICT "This assessment changed or is locked. Reload before editing."
  where feedback is invalid
  then
    refuse INVALID_JUDGMENTS "Feedback must be at most 20000 characters."
```

## Queries

```queries
_getAssessment (learner: String, item: String, evidence: String) : optional (grade: String, version: Number, method: String, status: String)
  answers the exact assessment identity for idempotent opening and correction
_getGrade (grade: String) : optional (grade: String, learner: String, item: String, evidence: String, grader: String, method: String, setupRevision: Number, criteria: Json, judgments: Json, feedback: String, status: String, version: Number, score: Number, outOf: Number, scored: Bool, createdAt: Date, updatedAt: Date, releasedAt: Date, history: Json)
  answers one assessment with point totals derived from its immutable snapshot and excused private values masked
_getGradesForLearner (learner: String) : many (grade: String, learner: String, item: String, evidence: String, grader: String, method: String, setupRevision: Number, criteria: Json, judgments: Json, feedback: String, status: String, version: Number, score: Number, outOf: Number, scored: Bool, createdAt: Date, updatedAt: Date, releasedAt: Date, history: Json)
  answers all of a learner's assessments in creation order
_getGradesForItem (item: String) : many (grade: String, learner: String, item: String, evidence: String, grader: String, method: String, setupRevision: Number, criteria: Json, judgments: Json, feedback: String, status: String, version: Number, score: Number, outOf: Number, scored: Bool, createdAt: Date, updatedAt: Date, releasedAt: Date, history: Json)
  answers all assessments on an item in creation order
```
