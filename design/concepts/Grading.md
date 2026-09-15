# Grading

## Purpose

Choose one grading method for an item, then record either categorical judgments
against fixed criteria or one numeric score for a learner. Release and correct
records without allowing an obsolete grading configuration to accept writes.

## Principle

Elena assesses Maya's paper against fixed competency criteria and retains each
released correction. Another paper is configured for 10 points, and Elena records
8.5. That grade keeps its denominator. Changing the maximum or grading method
requires explicit confirmation when records exist; the change deletes the retired
records and advances a generation, so delayed requests from the old setup fail.

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
a set of Configurations with
  an item Item
  a method of COMPETENCY or POINTS
  a generation Number
  a maxPoints Number

a set of Grades with
  a learner Learner
  an item Item
  an evidence Evidence
  a grader Grader
  a criteria set of Criterion
  a feedback String
  a version Number
  a generation Number
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

a set of Marks with
  a learner Learner
  an item Item
  an evidence Evidence
  a grader Grader
  a score Number
  a scored Bool
  an outOf Number
  a feedback String
  a version Number
  a generation Number
  a createdAt Date
  an updatedAt Date
  an optional releasedAt Date

a MarkDraft set of Marks
a MarkReleased set of Marks
a MarkExcused set of Marks

Rule: an item without a stored configuration is competency graded at generation zero with a retained default maximum of 100 points.
Rule: changing method, or changing the maximum in points mode, advances the generation and deletes every record of the retired method and generation.
Rule: a configuration change with records is refused unless discard is exactly true; the observed generation and reviewed record count must match before any deletion.
Rule: competency actions accept only the current competency generation, and numeric actions accept only the current points generation.
Rule: at most one grade has a given learner, item, evidence, and generation; repeated creation returns it unchanged.
Rule: a grade's learner, item, evidence, and selected criteria never change. At most 100 distinct criteria are selected.
Rule: a draft has at most one judgment per selected criterion; ratings are the five declared values, and feedback is at most 20000 characters.
Rule: every mutation compares the supplied version and required status atomically and increments version on success.
Rule: a release captures independent immutable values of competency judgments and feedback; retracting never erases releases.
Rule: only a competency draft with nonempty evidence, at least one criterion, and a disposition for every criterion can be released.
Rule: excused competency reads omit judgments; excusal is not a competency rating.
Rule: at most one mark has a given learner, item, and generation. A mark snapshots maxPoints as outOf when first recorded or excused.
Rule: maxima are finite positive numbers. Scores are finite numbers at least zero and at most the configuration maximum; decimal scores and zero are valid.
Rule: a mark with scored false is an excusal placeholder and cannot be released as a numeric grade.
```

## Actions

```actions
configure(item: Item, method: String, maxPoints: Number, generation: Number, discard: Bool, expectedCount: Number) : return (item: Item, method: String, maxPoints: Number, generation: Number, discarded: Number)
  where method and maximum are valid, generation is current, and the method and maximum are unchanged
  then
    preserve the configuration and records
    return item, method, maxPoints, generation, discarded
  where method and maximum are valid, generation is current, the retired generation has no records or discard is true, and expectedCount matches the reviewed record count when discarding
  then
    atomically with respect to every Grading action, delete records belonging to the retired method and generation, then advance generation and store method and maximum; a failed deletion leaves the configuration current for a safe retry
    return item, method, maxPoints, generation, discarded
  where method or maximum is invalid
  then
    refuse INVALID_GRADING_CONFIGURATION "Choose competency or points grading with a positive finite maximum."
  where generation is not current, or discard is true and expectedCount does not match the current record count
  then
    refuse GRADE_CONFLICT "The grading setup or grades changed. Reload and review before trying again."
  where the retired generation has records and discard is not true
  then
    refuse GRADING_RECORDS_EXIST "Changing this grading setup will delete existing grades. Confirm the deletion and try again."

record(learner: Learner, item: Item, evidence: Evidence, grader: Grader, criteria: Json, generation: Number, at: Date) : return (grade: Grade, version: Number)
  where item is competency graded at generation, criteria are distinct valid entries, and a grade already has learner, item, evidence, and generation
  then
    return grade, version
  where item is competency graded at generation, criteria are distinct valid entries, and no grade has learner, item, evidence, and generation
  then
    create one draft fixing learner, item, evidence, criteria, and generation, with version one and no judgments
    return grade, version
  where item is not competency graded at generation
  then
    refuse GRADE_CONFLICT "The grading method changed. Reload before editing this assessment."
  where criteria are invalid
  then
    refuse INVALID_JUDGMENTS "Select distinct criteria."

save(grade: Grade, version: Number, grader: Grader, judgments: Json, feedback: String, at: Date) : return (grade: Grade, version: Number)
  where grade is a current competency draft at version and judgments and feedback are valid
  then
    atomically replace its judgments and feedback, record grader and time, and increment version
    return grade, version
  where grade does not exist
  then
    refuse GRADE_NOT_FOUND "There is no assessment."
  where grade is not a current competency draft at version
  then
    refuse GRADE_CONFLICT "This assessment changed or is locked. Reload before editing."
  where judgments or feedback are invalid
  then
    refuse INVALID_JUDGMENTS "Use one valid level or Not assessed per criterion."

release(grade: Grade, version: Number, grader: Grader, at: Date) : return (grade: Grade, version: Number)
  where grade is a complete current competency draft at version
  then
    retain an immutable release, mark grade released, record grader and time, and increment version
    return grade, version
  where grade does not exist
  then
    refuse GRADE_NOT_FOUND "There is no assessment."
  where grade is not a current competency draft at version
  then
    refuse GRADE_CONFLICT "This assessment changed or is locked. Reload before editing."
  where grade is incomplete
  then
    refuse GRADE_INCOMPLETE "Assess every criterion or explicitly mark it Not assessed before release."

releaseItem(item: Item, generation: Number, grader: Grader, at: Date) : return (released: Json, skipped: Json, unconfirmed: Json)
  where item is competency graded at generation
  then
    attempt release of each draft at its observed version, retaining successes, reporting incomplete or changed drafts as skipped, and reporting unknown outcomes as unconfirmed
    return released, skipped, unconfirmed
  where item is not competency graded at generation
  then
    refuse GRADE_CONFLICT "The grading method changed. Reload before editing this assessment."

retract(grade: Grade, version: Number, grader: Grader, at: Date) : return (grade: Grade, version: Number)
  where grade is current, released, and at version
  then
    move it to draft, clear releasedAt, retain release history, record grader and time, and increment version
    return grade, version
  where grade does not exist
  then
    refuse GRADE_NOT_FOUND "There is no assessment."
  where grade is not current, released, and at version
  then
    refuse GRADE_CONFLICT "This assessment changed or is locked. Reload before editing."

restoreExcused(grade: Grade, version: Number, grader: Grader, at: Date) : return (grade: Grade, version: Number)
  where grade is current, excused, and at version
  then
    move it to draft, clear releasedAt, retain release history, record grader and time, and increment version
    return grade, version
  where grade does not exist
  then
    refuse GRADE_NOT_FOUND "There is no assessment."
  where grade is not current, excused, and at version
  then
    refuse GRADE_CONFLICT "This assessment changed or is locked. Reload before editing."

excuse(grade: Grade, version: Number, grader: Grader, feedback: String, at: Date) : return (grade: Grade, version: Number)
  where grade is a current draft at version and feedback is valid
  then
    retain an excusal release, mark grade excused, record grader and time, and increment version
    return grade, version
  where grade does not exist
  then
    refuse GRADE_NOT_FOUND "There is no assessment."
  where grade is not a current draft at version
  then
    refuse GRADE_CONFLICT "This assessment changed or is locked. Reload before editing."
  where feedback is invalid
  then
    refuse INVALID_JUDGMENTS "Feedback must be at most 20000 characters."

recordMark(learner: Learner, item: Item, evidence: Evidence, grader: Grader, score: Number, feedback: String, generation: Number, version: Number, at: Date) : return (mark: Mark, version: Number)
  where item is points graded at generation, score and feedback are valid, no mark exists, and version is zero
  then
    create a draft mark with scored true and outOf fixed from the current maximum
    return mark, version
  where item is points graded at generation, a draft mark exists at version, and score and feedback are valid
  then
    replace its evidence, grader, score, and feedback, set scored true, and increment version
    return mark, version
  where item is not points graded at generation or the mark is not draft at version
  then
    refuse MARK_CONFLICT "This point grade changed or is locked. Reload before editing."
  where score or feedback is invalid
  then
    refuse INVALID_MARK "Use a finite score from zero through the maximum and feedback of at most 20000 characters."

releaseMark(mark: Mark, version: Number, at: Date) : return (mark: Mark, version: Number)
  where mark is a scored current draft at version
  then
    mark it released, record time, and increment version
    return mark, version
  where mark does not exist
  then
    refuse MARK_NOT_FOUND "There is no point grade."
  where mark is not a current draft at version
  then
    refuse MARK_CONFLICT "This point grade changed or is locked. Reload before editing."
  where mark is not scored
  then
    refuse MARK_INCOMPLETE "Enter a score before releasing this grade."

retractMark(mark: Mark, version: Number, at: Date) : return (mark: Mark, version: Number)
  where mark is current, released, and at version
  then
    move it to draft, clear releasedAt, and increment version
    return mark, version
  where mark does not exist
  then
    refuse MARK_NOT_FOUND "There is no point grade."
  where mark is not current, released, and at version
  then
    refuse MARK_CONFLICT "This point grade changed or is locked. Reload before editing."

restoreExcusedMark(mark: Mark, version: Number, at: Date) : return (mark: Mark, version: Number)
  where mark is current, excused, and at version
  then
    move it to draft, clear releasedAt, and increment version
    return mark, version
  where mark does not exist
  then
    refuse MARK_NOT_FOUND "There is no point grade."
  where mark is not current, excused, and at version
  then
    refuse MARK_CONFLICT "This point grade changed or is locked. Reload before editing."

excuseMark(learner: Learner, item: Item, evidence: Evidence, grader: Grader, feedback: String, generation: Number, mark: Mark, version: Number, at: Date) : return (mark: Mark, version: Number)
  where item is points graded at generation, feedback is valid, and mark is a draft at version for learner and item
  then
    mark it excused, replace evidence, grader, and feedback, record time, and increment version
    return mark, version
  where item is points graded at generation, feedback is valid, mark is empty, no mark exists, and version is zero
  then
    create an excused mark with scored false and outOf fixed from the current maximum
    return mark, version
  where feedback is invalid
  then
    refuse INVALID_MARK "Feedback must be at most 20000 characters."
  where the observed mark or grading generation changed
  then
    refuse MARK_CONFLICT "This point grade changed or is locked. Reload before editing."

releaseMarks(item: Item, generation: Number, at: Date) : return (released: Json, skipped: Json, unconfirmed: Json)
  where item is points graded at generation
  then
    attempt release of each scored draft at its observed version, reporting unscored or changed drafts as skipped and unknown write outcomes as unconfirmed
    return released, skipped, unconfirmed
  where item is not points graded at generation
  then
    refuse MARK_CONFLICT "The grading method changed. Reload before editing this grade."
```

## Queries

```queries
_getConfiguration (item: String) : optional (item: String, method: String, generation: Number, maxPoints: Number)
  answers the stored configuration or the competency generation-zero default
_getCriteria (grade: String) : many (criterion: String)
  answers the grade's fixed criteria only while the grade belongs to the current competency generation
_getGrade (grade: String) : optional (grade: String, learner: String, item: String, evidence: String, grader: String, criteria: Json, judgments: Json, feedback: String, status: String, version: Number, createdAt: Date, updatedAt: Date, releasedAt: Date, history: Json)
  answers the assessment and correction history only while it belongs to the current competency generation
_getGradesForLearner (learner: String) : many (grade: String, learner: String, item: String, evidence: String, grader: String, criteria: Json, judgments: Json, feedback: String, status: String, version: Number, createdAt: Date, updatedAt: Date, releasedAt: Date, history: Json)
  answers current competency assessments of that learner in creation order
_getGradesForItem (item: String) : many (grade: String, learner: String, item: String, evidence: String, grader: String, criteria: Json, judgments: Json, feedback: String, status: String, version: Number, createdAt: Date, updatedAt: Date, releasedAt: Date, history: Json)
  answers current competency assessments of the item in creation order
_getMark (mark: String) : optional (mark: String, learner: String, item: String, evidence: String, grader: String, score: Number, scored: Bool, outOf: Number, feedback: String, status: String, version: Number, createdAt: Date, updatedAt: Date, releasedAt: Date)
  answers the point grade only while it belongs to the current points generation
_getMarksForLearner (learner: String) : many (mark: String, learner: String, item: String, evidence: String, grader: String, score: Number, scored: Bool, outOf: Number, feedback: String, status: String, version: Number, createdAt: Date, updatedAt: Date, releasedAt: Date)
  answers current point grades of the learner in creation order
_getMarksForItem (item: String) : many (mark: String, learner: String, item: String, evidence: String, grader: String, score: Number, scored: Bool, outOf: Number, feedback: String, status: String, version: Number, createdAt: Date, updatedAt: Date, releasedAt: Date)
  answers current point grades of the item in creation order
```
