# Grading

## Purpose

Give each learner one grade per item, with a score, maximum, feedback, and a
clear draft, released, or excused status. Each grade keeps the maximum used
when it was recorded.

## Principle

Ms. Okafor records Ana's essay grade as 42 out of 50, revises the draft to 45,
and releases it. Further recording is refused until she retracts it. She then
records 44 and releases every draft for the essay. Ben is excused, so recording
a score for him is refused. A score of 60 out of 50 is also refused.

## Types

```types
external Grader
  An application-owned identity used in the grader role.

external Learner
  An application-owned identity used in the learner role.

external Item
  An application-owned identity used in the item role.

external Criterion
  An application-owned identity used in the criterion role.

external Evidence
  An application-owned identity used in the evidence role.
```

## State

```state
a Grades with
  a learner    Learner
  an item      Item
  an evidence  Evidence
  a grader     Grader
  a score      Number
  an outOf     Number
  a feedback   String
  an updatedAt Date
  an optional releasedAt Date

a Draft    Grades
a Released Grades
an Excused Grades

a set of CriterionScores with
  a Grade
  a Criterion
  a points   Number
  an outOf   Number
  a feedback String
```

A learner has at most one grade per item, and a grade has at most one score for
each criterion. Each grade and criterion score keeps the maximum used when it
was recorded. Whether a score fits its maximum is calculated from the inputs:

A score is within outOf when it is at least zero and at most outOf.

Releasing an item returns every grade released by that action, or an empty set
when no drafts remain. Clearing a criterion's scores succeeds when none remain.

Releasing an item returns every grade released by that action, or an empty set
when no drafts remain. Clearing a criterion's scores succeeds when none remain.

## Actions

```actions
record(learner: Learner, item: Item, evidence: Evidence, grader: Grader, score: Number, outOf: Number, feedback: String, at: Date) : return (grade: Grade)
  where score is within outOf and the grade of learner and item is in draft
  then
    set grade's evidence, grader, score, outOf, and feedback from the inputs
    set grade's updatedAt to at
    return grade
  where score is within outOf and learner has no grade for item
  then
    add a new grade with learner, item, evidence, grader, score, outOf, and feedback
    set grade's updatedAt to at
    add grade to draft
    return grade
  where score is not within outOf
  then
    refuse SCORE_OUT_OF_RANGE "The score must be between zero and what the grade is out of."
  where the grade of learner and item is in released
  then
    refuse GRADE_ALREADY_RELEASED "This grade has already been released."
  where the grade of learner and item is in excused
  then
    refuse LEARNER_EXCUSED "This learner has been excused from this item."

scoreCriterion(learner: Learner, item: Item, criterion: Criterion, points: Number, outOf: Number, feedback: String) : return (criterionScore: CriterionScore)
  where the grade of learner and item is in draft, points is within outOf, and grade has a criterionScore for criterion
  then
    set criterionScore's points, outOf, and feedback from the inputs
    return criterionScore
  where the grade of learner and item is in draft, points is within outOf, and grade has no criterionScore for criterion
  then
    add a new criterionScore with grade, criterion, points, outOf, and feedback
    return criterionScore
  where learner has no grade for item
  then
    refuse GRADE_NOT_FOUND "There is no grade for this learner and item."
  where the grade of learner and item is in released
  then
    refuse GRADE_ALREADY_RELEASED "This grade has already been released."
  where the grade of learner and item is in excused
  then
    refuse LEARNER_EXCUSED "This learner has been excused from this item."
  where points is not within outOf
  then
    refuse SCORE_OUT_OF_RANGE "The points must be between zero and what the criterion is out of."

release(learner: Learner, item: Item, at: Date) : return (grade: Grade)
  where the grade of learner and item is in draft
  then
    remove grade from draft
    add grade to released
    set grade's releasedAt to at and updatedAt to at
    return grade
  where learner has no grade in draft for item
  then
    refuse GRADE_DRAFT_NOT_FOUND "There is no draft grade for this learner and item."

releaseItem(item: Item, at: Date) : return (released: Grades)
  where true
  then
    remove every draft grade of item from draft and add each to released
    set each one's releasedAt to at and updatedAt to at
    return released

retract(learner: Learner, item: Item, at: Date) : return (grade: Grade)
  where the grade of learner and item is in released
  then
    remove grade from released
    add grade to draft
    set grade's releasedAt to none and updatedAt to at
    return grade
  where learner has no released grade for item
  then
    refuse GRADE_RELEASED_NOT_FOUND "There is no released grade for this learner and item."

excuse(learner: Learner, item: Item, grader: Grader, feedback: String, at: Date) : return (grade: Grade)
  where learner has a grade for item
  then
    remove grade from draft and from released
    add grade to excused
    set grade's score to 0, grader to grader, feedback to feedback, releasedAt to none, and updatedAt to at
    return grade
  where learner has no grade for item
  then
    refuse GRADE_NOT_FOUND "There is no grade for this learner and item."

clearCriterionScores(criterion: Criterion) : return (criterion: Criterion)
  where true
  then
    delete every criterionScore for criterion
    return criterion
```

## Queries

```queries
_getGrade (learner: String, item: String) : optional (grade: String, score: Number, outOf: Number, status: String, feedback: String)
  answers the Learner's Grade for the Item with its score, maximum, status, and feedback
  answers no row when no Grade exists

_getGradesForLearner (learner: String) : many (item: String, grade: String, score: Number, outOf: Number, status: String, feedback: String)
  answers all of the learner's grades in creation order, including each recorded maximum and feedback
  answers no rows when none match

_getGradesForItem (item: String) : many (learner: String, grade: String, score: Number, status: String)
  answers all grades for the item in creation order
  answers no rows when none match

_getCriterionScores (learner: String, item: String) : many (criterion: String, points: Number, feedback: String)
  answers the grade's criterion scores in creation order
  answers no rows when none match
```
