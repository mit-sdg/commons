# Grading

## Purpose

Record categorical judgments against a fixed set of criteria for a learner's
particular evidence, release them together, and correct them without rewriting
previously released judgments. New evidence has a separate assessment.

## Principle

Elena starts an assessment of Maya's first paper attempt, fixing its criteria.
She saves Emergent for Argumentation and explicitly marks Evidence Not assessed.
She releases the complete assessment; its judgments and feedback become one
retained release. Editing a released assessment is refused. Elena retracts it,
corrects an erroneous judgment, and releases again. The previous release remains
in correction history rather than becoming a second assessment. Maya's second
attempt receives its own assessment. Two editors saving the same version cannot
overwrite one another. Releasing an incomplete draft is refused. Elena excuses a
draft, then restores it to draft when the excusal was mistaken. Bulk release
releases complete drafts and reports each incomplete or concurrently changed
assessment it skipped.

## Types

```types
external Grader
  The identity acting as assessor.
external Learner
  The identity whose work is assessed.
external Item
  The activity under assessment.
external Criterion
  An opaque assessment dimension interpreted by the application.
external Evidence
  The particular work under assessment, or the application's empty-evidence marker for an excusal.
```

## State

```state
a set of Grades with
  a learner Learner
  an item Item
  an evidence Evidence
  a grader Grader
  a criteria set of Criterion
  a feedback String
  a version Number
  a createdAt Date
  an updatedAt Date
  an optional releasedAt Date

a Draft set of Grades
a Released set of Grades
an Excused set of Grades

a set of Judgments with
  a Grade
  a Criterion
  a rating of DEFICIENT or EMERGENT or COMPETENT or EXPERT or NOT_ASSESSED
  a feedback String

a set of Releases with
  a Grade
  a revision Number
  a grader Grader
  a feedback String
  a releasedAt Date
  a status of RELEASED or EXCUSED

a set of ReleasedJudgments with
  a Release
  a Criterion
  a rating of DEFICIENT or EMERGENT or COMPETENT or EXPERT or NOT_ASSESSED
  a feedback String

Rule: at most one grade has a given learner, item, and evidence; repeated creation returns it unchanged.
Rule: a grade's learner, item, evidence, and selected criteria never change. At most 100 distinct criteria are selected.
Rule: a draft has at most one judgment per selected criterion; ratings are the five declared values, and feedback is at most 20000 characters.
Rule: record fixes the criteria at assessment creation; later item configuration cannot change that set.
Rule: every mutation compares the supplied version and required status atomically and increments version on success.
Rule: a release captures independent immutable values of the judgments and feedback; retracting never erases releases.
Rule: only a draft with nonempty evidence, at least one criterion, and a disposition for every selected criterion can be released.
Rule: excused reads omit judgments; excusal is not a competency rating.
```

## Actions

```actions
record(learner: Learner, item: Item, evidence: Evidence, grader: Grader, criteria: Json, at: Date) : return (grade: Grade, version: Number)
  where criteria are distinct valid criterion entries and a grade already has learner, item, and evidence
  then
    return grade, version
  where criteria are distinct valid criterion entries and no grade has learner, item, and evidence
  then
    atomically create one draft fixing learner, item, evidence, and criteria, with no judgments, empty feedback, version one, grader, and creation and update time at
    return grade, version
  where criteria are invalid
  then
    refuse INVALID_JUDGMENTS "Select distinct criteria."

save(grade: Grade, version: Number, grader: Grader, judgments: Json, feedback: String, at: Date) : return (grade: Grade, version: Number)
  where grade is draft at version and judgments and feedback are valid
  then
    atomically replace its draft judgments and feedback, record grader and time, and increment version
    return grade, version
  where grade does not exist
  then
    refuse GRADE_NOT_FOUND "There is no assessment."
  where grade is not draft at version
  then
    refuse GRADE_CONFLICT "This assessment changed or is locked. Reload before editing."
  where judgments or feedback are invalid
  then
    refuse INVALID_JUDGMENTS "Use one valid level or Not assessed per criterion."

release(grade: Grade, version: Number, grader: Grader, at: Date) : return (grade: Grade, version: Number)
  where grade is a complete draft at version
  then
    atomically retain an immutable release, mark grade released, record grader and time, and increment version
    return grade, version
  where grade does not exist
  then
    refuse GRADE_NOT_FOUND "There is no assessment."
  where grade is not draft at version
  then
    refuse GRADE_CONFLICT "This assessment changed or is locked. Reload before editing."
  where grade is incomplete
  then
    refuse GRADE_INCOMPLETE "Assess every criterion or explicitly mark it Not assessed before release."

releaseItem(item: Item, grader: Grader, at: Date) : return (released: Json, skipped: Json, unconfirmed: Json)
  where true
  then
    attempt release of each draft at its observed version, retaining successes and reporting incomplete or concurrently changed drafts as skipped
    retain known released and skipped outcomes if an individual release faults; report that record as unconfirmed because its write may have committed, continue the batch, and require readback before retrying
    return released, skipped, unconfirmed

retract(grade: Grade, version: Number, grader: Grader, at: Date) : return (grade: Grade, version: Number)
  where grade is released at version
  then
    atomically return it to draft, clear releasedAt, retain release history, record grader and time, and increment version
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
    atomically return it to draft, clear releasedAt, retain release history, record grader and time, and increment version
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
    atomically retain an excusal release, mark grade excused, record grader and time, and increment version
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
_getCriteria (grade: String) : many (criterion: String)
  answers the grade's fixed assessment criteria
_getGrade (grade: String) : optional (grade: String, learner: String, item: String, evidence: String, grader: String, criteria: Json, judgments: Json, feedback: String, status: String, version: Number, createdAt: Date, updatedAt: Date, releasedAt: Date, history: Json)
  answers the assessment and its retained correction history
_getGradesForLearner (learner: String) : many (grade: String, learner: String, item: String, evidence: String, grader: String, criteria: Json, judgments: Json, feedback: String, status: String, version: Number, createdAt: Date, updatedAt: Date, releasedAt: Date, history: Json)
  answers all assessments of that learner in creation order; application projections enforce disclosure
_getGradesForItem (item: String) : many (grade: String, learner: String, item: String, evidence: String, grader: String, criteria: Json, judgments: Json, feedback: String, status: String, version: Number, createdAt: Date, updatedAt: Date, releasedAt: Date, history: Json)
  answers all assessments of the item in creation order
```
