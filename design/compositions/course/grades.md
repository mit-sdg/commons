# Grades

Staff with grade-management capability use
[Course.grades.GradesConfigureItem](reaction:Course.grades.GradesConfigureItem) to create or update an active grade item's
label and maximum. A caller with grade-view capability can inspect that item and
its ordered criteria through [Course.grades.GradesItem](reaction:Course.grades.GradesItem); a missing item is
reported explicitly rather than returned as an empty item.

[Course.grades.GradesAddCriterion](reaction:Course.grades.GradesAddCriterion) adds an ordered scoring criterion to an
active item. [Course.grades.GradesReviseCriterion](reaction:Course.grades.GradesReviseCriterion) changes that criterion's
name, maximum, and position. [Course.grades.GradesRemoveCriterion](reaction:Course.grades.GradesRemoveCriterion) first removes the selected scoring
criterion from Itemizing state. Its successful return triggers
[Course.grades.RemovedCriterionClearsScores](reaction:Course.grades.RemovedCriterionClearsScores), which deletes that criterion's
scores from Grading. The cleanup is a separate consequence: if it faults, the
criterion stays removed while stale scores can remain. Changing a criterion's maximum does not rewrite the maximum retained with an
existing Grading score. [Course.grades.GradesCriterionScores](reaction:Course.grades.GradesCriterionScores) returns the
remaining points and feedback for one learner and item, but presents each score
beside the criterion's current Itemizing maximum.

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

An active student sees only their own released and excused results through
[Course.grades.GradesForMe](reaction:Course.grades.GradesForMe). [Course.grades.GradesForStudent](reaction:Course.grades.GradesForStudent) gives grade viewers all of one learner's
grades. [Course.grades.GradesForItem](reaction:Course.grades.GradesForItem) gives grade viewers every recorded grade on one
item.
[Course.grades.GradesGradebook](reaction:Course.grades.GradesGradebook) joins current active students, active grade
items, and any grade cells at read time rather than storing a snapshot.
[Course.grades.GradesExport](reaction:Course.grades.GradesExport) has the same staff guard but is currently a
placeholder that returns an empty CSV string.

## Supporting declarations

Formers [theCriteriaOf](former:Course.grades.theCriteriaOf), [theCriterionScoresOf](former:Course.grades.theCriterionScoresOf), [theGradebook](former:Course.grades.theGradebook), [theGradebookLearners](former:Course.grades.theGradebookLearners), [theGradesOf](former:Course.grades.theGradesOf), [theGradesOn](former:Course.grades.theGradesOn), [theReleasedGradesOf](former:Course.grades.theReleasedGradesOf) support the behavior and result shapes described above.
