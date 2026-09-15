# Grading setup and assessment lifecycle

This composition presents competency and point grading as two setup methods of
one assessment lifecycle. `Itemizing` supplies one coherent revisioned current
setup; competency rubric editions are immutable and expanded into complete
criterion definitions before `Grading` starts an assessment. Once started, an
assessment is interpreted entirely from its stored snapshot.

[Extract competency edition identities from setup input](computation:competencyEditionIds).

[Expand current criteria with immutable rubric editions](computation:resolveGradingCriteria).

[Compare two setup revisions without coercion](computation:gradingRevisionMatches).

Staff save the whole setup draft in one compare-and-swap. Missing criterion
identities are allocated by Itemizing. The composition verifies every selected
competency basis names an existing immutable edition before the setup write.
Setup writes never inspect or change assessments, and revisions apply only to
setup concurrency and first creation. A delayed first creation must match the
observed current revision. Opening an existing learner/item/evidence assessment
takes precedence and never depends on the current setup.

An assessment belongs to one learner, item, and exact evidence identity. Empty
evidence is reserved for an assignment-wide excusal. Separate attempts stay
separate. Staff authority, active enrollment, assignment audience, and submitted
evidence govern first creation; an existing assessment can still be corrected
after archival. The authenticated session supplies the grader on every write.

Both methods use the same draft, feedback, version, release, retract, correction,
excusal, and history actions. Point drafts may omit judgments, while entered zero
is a real judgment. Release requires every immutable criterion to be complete.
Point totals and denominators derive from the snapshot and are finite. Excused
public rows hide private draft judgments and scores. Learners see only their own
released or excused records.

Consumers selecting one result for an attempt use its exact evidence assessment
first. Only when none exists may an empty-evidence `EXCUSED` assessment serve as
the assignment-wide fallback; an attempt-specific excusal never applies to other
attempts.

[Authorize current item setup through staff authority or assigned published work](view:Course.grades.mayReadItem).

[Authorize one assessment through staff authority or learner ownership and public status](view:Course.grades.mayReadAssessment).

[Authorize first creation through active enrollment, assigned published work, and matching submitted evidence or the empty excusal marker](view:Course.grades.mayStartAssessment).

[Resolve one coherent Itemizing setup into complete criterion definitions](former:Course.grades.theSetupOf).

[Form the learner-visible released and excused assessment history](former:Course.grades.theReleasedGradesOf).

[Form all assessments of one learner for staff](former:Course.grades.theGradesOf).

[Form every assessment on one item for staff](former:Course.grades.theGradesOn).

[Form one assessment with supporting-work metadata](former:Course.grades.theAssessment).

[Join active roster learners to their shared assessment histories](former:Course.grades.theGradebookLearners).

[Form current item setup summaries and learner histories](former:Course.grades.theGradebook).

[Form the current standard catalog](former:Course.grades.theStandards).

[Define a complete immutable first standard edition](reaction:Course.grades.GradesDefineStandard).

[Issue a new standard edition with an expected-edition concurrency check](reaction:Course.grades.GradesReviseStandard).

[Configure an existing assignment as a default assessment item](reaction:Course.grades.GradesConfigureItem).

[Atomically save the complete method and ordered criterion setup after edition validation](reaction:Course.grades.GradesConfigureSetup).

[Save draft competency or point judgments and shared feedback at the observed assessment version](reaction:Course.grades.GradesSave).

[Release a complete draft and append immutable history](reaction:Course.grades.GradesRelease).

[Retract a release for correction while retaining its history and snapshot](reaction:Course.grades.GradesRetract).

[Restore an excusal to its private draft values](reaction:Course.grades.GradesRestoreExcused).

[Release an explicit excusal without exposing private draft values](reaction:Course.grades.GradesExcuse).

[Release complete drafts across stored methods and snapshots while reporting skips and uncertain writes](reaction:Course.grades.GradesReleaseItem).

[Read an authorized current item setup](reaction:Course.grades.GradesItem).

[Read one authorized assessment](reaction:Course.grades.GradesDetail).

[Open an existing exact assessment first, or start one from the caller-observed current setup](reaction:Course.grades.GradesRecord).

[Read the signed-in active learner's released and excused history](reaction:Course.grades.GradesForMe).

[Read the staff standard catalog](reaction:Course.grades.GradesStandards).

[Read one learner's assessment history as staff](reaction:Course.grades.GradesForStudent).

[Read one item's assessment history as staff](reaction:Course.grades.GradesForItem).

[Read the staff gradebook](reaction:Course.grades.GradesGradebook).

[Keep the guarded whole-gradebook export placeholder](reaction:Course.grades.GradesExport).

```endpoints
Course.grades.GradesDefineStandard at /grades/define-standard
Course.grades.GradesReviseStandard at /grades/revise-standard
Course.grades.GradesConfigureItem at /grades/configure-item
Course.grades.GradesConfigureSetup at /grades/configure-setup
Course.grades.GradesSave at /grades/save
Course.grades.GradesRelease at /grades/release
Course.grades.GradesRetract at /grades/retract
Course.grades.GradesRestoreExcused at /grades/restore-excused
Course.grades.GradesExcuse at /grades/excuse
Course.grades.GradesReleaseItem at /grades/release-item
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

```computations
competencyEditionIds(criteria: Json) : Strings
  Extracts distinct-candidate competency basis identifiers for immutable-edition validation before a setup write.
resolveGradingCriteria(criteria: Json, editions: Json) : Json
  Expands one coherent Itemizing criterion list with complete immutable competency editions while preserving point definitions.
gradingRevisionMatches(left: Number, right: Number) : Bool
  Compares an observed setup revision with the current revision without coercion.
```
