# Assessments and standards

This composition joins opaque criteria to immutable standard editions. The fixed
criteria of an assessment are captured when staff start it, so subsequent setup
changes apply to new assessments. There is no computed current or highest level.

Staff holding `grade` manage standards and assessments; all new learner/item/evidence
relationships are checked before an assessment is created. Empty evidence is a
placeholder for excusal and cannot be released as an assessed attempt. Existing
assessments remain attributable after evidence withdrawal; staff corrections refer
to that retained work. Grade creation is idempotent per learner, item, and evidence.
All edits and individual transitions require the version the editor observed.

Learners can see only their own currently released or excused assessments. A
retracted assessment and its correction history are hidden until it is released
again. The application returns frozen criterion definitions along with judgments,
including previous releases when the current assessment is visible. Assignment
audience changes do not revoke ownership of already released assessment history.
Standard management and its full catalog are staff-only; students read standards
selected for their assigned work or included in their own released assessments.

The gradebook lists assessments, not a representative learner level. Bulk release
is explicitly partial: it releases complete observed drafts and reports incomplete
or concurrently changed drafts individually as skipped. The export route remains
an empty placeholder, with the same staff permission.

[Authorize item definitions through staff authority, assigned published work, or owned released history](view:Course.grades.mayReadItem).

[Authorize an assessment through staff authority or learner ownership and release status](view:Course.grades.mayReadAssessment).

[Resolve selected item criteria to their standard editions](former:Course.grades.theCriteriaOf).

[Resolve the fixed criterion set, including retired criteria, to immutable editions](former:Course.grades.theAssessmentCriteria).

[Capture the ordered criterion identities for a new assessment](former:Course.grades.selectedCriteria).

[Form the learner-visible history with only released and excused assessments](former:Course.grades.theReleasedGradesOf).

[Form all assessments of a learner for authorized staff](former:Course.grades.theGradesOf).

[Form every assessment on an item for authorized staff](former:Course.grades.theGradesOn).

[Form one assessment with its evidence dates and correction history](former:Course.grades.theAssessment).

[Join roster identities and profiles to their assessment histories](former:Course.grades.theGradebookLearners).

[Form active item and learner lists without totals or proficiency aggregation](former:Course.grades.theGradebook).

[Form the current standard catalog](former:Course.grades.theStandards).

[Define a complete immutable first standard edition](reaction:Course.grades.GradesDefineStandard).

[Issue a new standard edition with an expected-edition concurrency check](reaction:Course.grades.GradesReviseStandard).

[Reorder a selected criterion without changing its basis](reaction:Course.grades.GradesReviseCriterion).

[Retire a criterion without deleting historical meaning](reaction:Course.grades.GradesRemoveCriterion).

[Atomically save draft judgments and feedback at the observed version](reaction:Course.grades.GradesSave).

[Release a complete draft at its observed version](reaction:Course.grades.GradesRelease).

[Retract a release for correction while retaining its historical values](reaction:Course.grades.GradesRetract).

[Return an excusal to draft for correction](reaction:Course.grades.GradesRestoreExcused).

[Release an explicit excusal from draft](reaction:Course.grades.GradesExcuse).

[Release complete drafts and report skips](reaction:Course.grades.GradesReleaseItem).

[Configure an existing assignment as an assessment item](reaction:Course.grades.GradesConfigureItem).

[Select a verified standard edition as an item criterion](reaction:Course.grades.GradesAddCriterion).

[Read an authorized item and its selected definitions](reaction:Course.grades.GradesItem).

[Read one authorized assessment](reaction:Course.grades.GradesDetail).

[Require active enrollment, assigned published accepting work, and matching submitted evidence or an empty excusal placeholder](view:Course.grades.mayStartAssessment).

[Start or find an assessment with validated evidence and fixed criteria](reaction:Course.grades.GradesRecord).

[Read the signed-in active learner’s released history](reaction:Course.grades.GradesForMe).

[Read the staff standard catalog](reaction:Course.grades.GradesStandards).

[Read learner assessment history as staff](reaction:Course.grades.GradesForStudent).

[Read item assessment history as staff](reaction:Course.grades.GradesForItem).

[Read the staff assessment book](reaction:Course.grades.GradesGradebook).

[Keep the guarded export placeholder](reaction:Course.grades.GradesExport).

```endpoints
Course.grades.GradesDefineStandard at /grades/define-standard
Course.grades.GradesReviseStandard at /grades/revise-standard
Course.grades.GradesReviseCriterion at /grades/revise-criterion
Course.grades.GradesRemoveCriterion at /grades/remove-criterion
Course.grades.GradesSave at /grades/save
Course.grades.GradesRelease at /grades/release
Course.grades.GradesRetract at /grades/retract
Course.grades.GradesRestoreExcused at /grades/restore-excused
Course.grades.GradesExcuse at /grades/excuse
Course.grades.GradesReleaseItem at /grades/release-item
Course.grades.GradesConfigureItem at /grades/configure-item
Course.grades.GradesAddCriterion at /grades/add-criterion
Course.grades.GradesItem at /grades/item
Course.grades.GradesDetail at /grades/detail
Course.grades.GradesRecord at /grades/record
Course.grades.GradesForMe at /grades/for-me
Course.grades.GradesStandards at /grades/standards
Course.grades.GradesForStudent at /grades/for-student
Course.grades.GradesForItem at /grades/for-item
Course.grades.GradesGradebook at /grades/gradebook
Course.grades.GradesExport at /grades/export
```

Current item setup is available only to grading staff or active learners with published assigned work. Historical-only access uses the fixed criteria inside owned released assessments; it does not grant the current item setup. Bulk release reports `unconfirmed` records separately when a persistence outcome cannot be confirmed, preserves known successes and skips, and asks staff to inspect refreshed state before retrying.
