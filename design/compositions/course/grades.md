# Grades

Staff holding `grade` use
[Course.grades.GradesConfigureItem](reaction:Course.grades.GradesConfigureItem) to create or update an active grade item's
label and maximum. A caller holding the same capability can inspect that item and
[its ordered criteria](former:Course.grades.theCriteriaOf) through
[Course.grades.GradesItem](reaction:Course.grades.GradesItem); a missing item is
reported explicitly rather than returned as an empty item. Managing grades and
reading somebody else's are deliberately one capability now rather than two:
`grade` covers both, so anybody trusted to read another learner's grades can also
configure items and record scores.

[Course.grades.GradesAddCriterion](reaction:Course.grades.GradesAddCriterion) adds an ordered scoring criterion to an
active item. [Course.grades.GradesReviseCriterion](reaction:Course.grades.GradesReviseCriterion) changes that criterion's
name, maximum, and position. [Course.grades.GradesRemoveCriterion](reaction:Course.grades.GradesRemoveCriterion) first removes the selected scoring
criterion from Itemizing state. Its successful return triggers
[Course.grades.RemovedCriterionClearsScores](reaction:Course.grades.RemovedCriterionClearsScores), which deletes that criterion's
scores from Grading. The cleanup is a separate consequence: if it faults, the
criterion stays removed while stale scores can remain. Changing a criterion's maximum does not rewrite the maximum retained with an
existing Grading score. [Course.grades.GradesCriterionScores](reaction:Course.grades.GradesCriterionScores) forms
[the remaining criterion scores](former:Course.grades.theCriterionScoresOf) for one learner and item,
presenting each score beside the criterion's current Itemizing maximum.

[Course.grades.GradesRecord](reaction:Course.grades.GradesRecord) records a draft score and feedback using the grade
item's current maximum. Evidence is an optional submission identity supplied by staff; recording does
not verify that the submission belongs to the learner or item. [Course.grades.GradesScoreCriterion](reaction:Course.grades.GradesScoreCriterion) similarly uses the criterion's
current maximum and refuses a missing criterion or one belonging to another
item.

[Course.grades.GradesRelease](reaction:Course.grades.GradesRelease) releases one learner's draft grade for an item.
[Course.grades.GradesReleaseItem](reaction:Course.grades.GradesReleaseItem) releases every draft grade currently on an
item. [Course.grades.GradesRetract](reaction:Course.grades.GradesRetract) returns one released learner-and-item grade
to draft.
[Course.grades.GradesExcuse](reaction:Course.grades.GradesExcuse) marks an existing grade excused with staff
feedback. These transitions use current application time and retain Grading's
state-specific refusals.

An active student sees only
[their released and excused results](former:Course.grades.theReleasedGradesOf) through
[Course.grades.GradesForMe](reaction:Course.grades.GradesForMe).
[Course.grades.GradesForStudent](reaction:Course.grades.GradesForStudent) gives callers holding `grade`
[all grades for one learner](former:Course.grades.theGradesOf).
[Course.grades.GradesForItem](reaction:Course.grades.GradesForItem) gives the same callers
[every recorded grade on one item](former:Course.grades.theGradesOn), including its saved feedback.
[Course.grades.GradesGradebook](reaction:Course.grades.GradesGradebook) builds
[the current gradebook](former:Course.grades.theGradebook) from active students, active grade
items, and any grade cells with their saved feedback at read time rather than storing a snapshot. The narrower
[theGradebookLearners former](former:Course.grades.theGradebookLearners) exposes the learners a
gradebook-oriented read covers: the account behind each active seat, presented
through that account's own profile fields, since a seat records no name of its
own.
[Course.grades.GradesExport](reaction:Course.grades.GradesExport) has the same `grade` guard but is currently a
placeholder that returns an empty CSV string.

```endpoints
Course.grades.GradesAddCriterion at /grades/add-criterion
Course.grades.GradesConfigureItem at /grades/configure-item
Course.grades.GradesCriterionScores at /grades/criterion-scores
Course.grades.GradesExcuse at /grades/excuse
Course.grades.GradesExport at /grades/export
Course.grades.GradesForItem at /grades/for-item
Course.grades.GradesForMe at /grades/for-me
Course.grades.GradesForStudent at /grades/for-student
Course.grades.GradesGradebook at /grades/gradebook
Course.grades.GradesItem at /grades/item
Course.grades.GradesRecord at /grades/record
Course.grades.GradesRelease at /grades/release
Course.grades.GradesReleaseItem at /grades/release-item
Course.grades.GradesRemoveCriterion at /grades/remove-criterion
Course.grades.GradesRetract at /grades/retract
Course.grades.GradesReviseCriterion at /grades/revise-criterion
Course.grades.GradesScoreCriterion at /grades/score-criterion
```
