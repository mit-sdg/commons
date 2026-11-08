# Course grades

Course staff turn released competency ratings into a course grade. A policy
says how: the value of each rating and of missing work, what late work without
late days counts as, groups of assignments or skills with their weights, an
attendance rule, and the grade lines. Staff try policies side by side, record
the few judgments a policy can't make as overrides, release each student's
grade so far at a checkpoint, and download the final grades at the end of the
term.

## Who reads and changes what

The page shows every student's average and rank, so it is read by a caller
holding `grade` who is not enrolled as an active student; the same rule
guards the staff gradebook. Changing policies, overrides, and releases, and
downloading, needs `grade-policies` as well as reading the page.
Administrators hold both through `administer`. A student reads only their own
released card.

## The inputs

[The course-grade inputs](view:Course.courseGrades.theCourseGradeInputs)
gather the class in one row, each from a read that answers a whole list:
published and archived assignments, every release with its due override, every
attempt, every grade without rubric text or feedback (judgments only for
released grades), standing late days and the hours per day, the active
students with their names, the runs held as lectures with everyone who joined
them or their rounds, the class time zone, and the standing overrides.
[courseGradeInputs](computation:courseGradeInputs) shapes them for the
calculation. The page returns these inputs to the browser, which runs the same
calculation the server runs for releases, overrides, and the download.

## The calculation

A student's work on an assignment counts through the attempt the submissions
export chooses, the latest submitted one, and that attempt's grade only when
it is released. Work not yet due, excused, a draft (including a grade
retracted for correction), a submitted attempt not graded yet, and an
assignment the student wasn't assigned are left out, and the remaining weights
scale up. Work past the student's own due date, with their due override and
late days, with nothing handed in counts as the policy's Missing value; work
handed in after that date counts as Missing or as graded, by the policy's rule.
A competency assignment averages its skills by the policy's skill weights,
leaving out `NOT_ASSESSED`; a points assignment counts its share of the rating
range. A skill row follows one skill across the term by its latest, best, or
average rating, from personal work or from all work; team work is the work of
kind Final project. Each average is rounded to two decimals once and graded
from the rounded value. The letter comes from the lines in the policy's grade
set, then the attendance rule caps it, then an override replaces it.

## Policies and overrides

[Course.courseGrades.Read](reaction:Course.courseGrades.Read) forms
[the page](former:Course.courseGrades.theCourseGradesPage): the inputs,
[every policy](former:Course.courseGrades.thePolicies) without its
specification, [the releases](former:Course.courseGrades.theReleaseHistory),
[the standing updates of single students](former:Course.courseGrades.theStudentUpdates),
and the sections. [Course.courseGrades.ReadPolicy](reaction:Course.courseGrades.ReadPolicy)
reads one policy's current specification and
[Course.courseGrades.ReadVersion](reaction:Course.courseGrades.ReadVersion) one
saved version, for loading, comparing, and naming what a colleague changed.

[Course.courseGrades.CreatePolicy](reaction:Course.courseGrades.CreatePolicy)
and [Course.courseGrades.SavePolicy](reaction:Course.courseGrades.SavePolicy)
check a specification's shape with [policyIsWellFormed](computation:policyIsWellFormed),
which the browser runs too, and answer `INVALID_POLICY` for one that fails.
Save names the version it was made from, and Policymaking refuses it with
`POLICY_STALE` when someone saved since; Save a copy is a create.
[Course.courseGrades.RenamePolicy](reaction:Course.courseGrades.RenamePolicy),
[Course.courseGrades.RemovePolicy](reaction:Course.courseGrades.RemovePolicy),
and [Course.courseGrades.MarkFinal](reaction:Course.courseGrades.MarkFinal)
pass straight to Policymaking.

[Course.courseGrades.SetOverride](reaction:Course.courseGrades.SetOverride)
records a grade and a reason for an active student. The grade it replaced is
worked out here by [overrideReplaced](computation:overrideReplaced) from the
named policy's saved version over the current inputs; the browser never
supplies it. [Course.courseGrades.ClearOverride](reaction:Course.courseGrades.ClearOverride)
removes one.

## Releases

A release to the class is an edition of the reserved material `course-grades`
in CourseGradePublishing, and CourseGradeSnapshotting keeps what it released.
[Course.courseGrades.Release](reaction:Course.courseGrades.Release) uses
[the final policy](view:Course.courseGrades.theFinalPolicy) as saved, and
answers `NO_FINAL_POLICY` without one. [releaseValue](computation:releaseValue)
computes every active student's grade with work due by the chosen date. It
keeps the policy, the settings, the class's assignments and lecture dates, who
released, and when once, and for each student their card, why they were held,
and only their own inputs: their releases, attempts, assessments, late-day
uses, the lectures they joined, and their override. A student below C in the policy's grade set, or with a draft or
an ungraded submission among the counted work, is held and gets the held card,
unless the request names them among those released after a look. The release
is published first and its value captured with it after, computed from the
state the publish left. When [a release is open](view:Course.courseGrades.theOpenRelease),
[Course.courseGrades.ReleaseAgain](reaction:Course.courseGrades.ReleaseAgain)
closes it before publishing the new one.
[Course.courseGrades.ReleaseRefused](reaction:Course.courseGrades.ReleaseRefused)
answers a request without a final policy, with settings that don't read, or
from a caller who may not change course grades.

[Course.courseGrades.UpdateStudent](reaction:Course.courseGrades.UpdateStudent)
re-releases one student under the open release's policy and settings, with a
reason, as an edition whose material is that student and which keeps that
student's copy alone;
[Course.courseGrades.UpdateStudentAgain](reaction:Course.courseGrades.UpdateStudentAgain)
closes the student's older update first, and
[Course.courseGrades.UpdateStudentRefused](reaction:Course.courseGrades.UpdateStudentRefused)
answers `NOT_RELEASED` with no open release. [Course.courseGrades.Hide](reaction:Course.courseGrades.Hide)
closes the open release.

[Course.courseGrades.Mine](reaction:Course.courseGrades.Mine) gives an active
student their own card through [ownCourseGrade](computation:ownCourseGrade):
from the newest release while it is open, or from their own update when that
is newer; `withdrawn` when the newest release is hidden; `none` before any
release that names them. The release's other cards never leave the server.

[Course.courseGrades.Export](reaction:Course.courseGrades.Export) writes the
final grades as CSV with [courseGradesCsv](computation:courseGradesCsv): one
row per active student under the final policy as of now, with name, email,
section, each group, the average, the grade, the policy's grade, the reason
for an override or attendance cap, lectures, and the policy's name and version.

```computations
courseGradeInputs(assignments: Seq, releases: Seq, attempts: Seq, ratings: Seq, uses: Seq, unitHours: Number, students: Seq, names: Seq, lectures: Seq, editions: Seq, parts: Seq, participation: Seq, detail: Class, overrides: Seq) : Json
  Shapes the class-wide reads into the calculation's inputs, joining each lecture run to everyone who responded to it or its rounds.

lectureSubjectList(lectures: Seq, parts: Seq) : Seq
  Lists the lecture runs and their rounds, the subjects whose participants count.

studentUsers(students: Seq) : Seq
  Lists the active students' identities.

policyIsWellFormed(specification: Json) : Bool
  Says whether a value is a complete policy: rating values, Missing, the late rule, skill weights, groups with rows, attendance rules, the grade set, and both sets of lines.

overrideReplaced(specification: Json, inputs: Json, student: String, at: Date) : String
  Answers the student's grade under the policy after the attendance rule, as of now.

releasedPolicy(policy: String, name: String, version: Number, specification: Json) : Json
  Keeps the final policy's identity, name, version, and specification together.

validReleaseSettings(dueBy: String, breakdown: Bool, letter: Bool, includeOverrides: Bool, release: Seq) : Bool
  Says whether a release names a readable cutoff, three switches, and a list of students released after a look.

releaseSettings(dueBy: String, breakdown: Bool, letter: Bool, includeOverrides: Bool) : Json
  Keeps the release's settings, with overrides off unless the letter is on.

releaseValue(policy: Json, inputs: Json, settings: Json, release: Seq, by: String, at: Date) : CourseGradeRelease
  Computes every active student's card under the policy and settings, holding students below C or with drafts or ungraded work unless released by name.

updateValue(release: CourseGradeRelease, inputs: Json, student: String, reason: String, by: String, at: Date) : CourseGradeRelease
  Computes one student's card again under the open release's policy and settings, keeping only that student's inputs.

ownCourseGrade(student: String, release: CourseGradeRelease, releaseOpen: Bool, releaseOpenedAt: Date, update: CourseGradeRelease, updateOpen: Bool, updateOpenedAt: Date) : Json
  Answers the student's own card and whether it is released, withdrawn, or not released yet.

releaseSummary(value: CourseGradeRelease) : Json
  Answers what staff see of a release or an update: every card and who was held, without the inputs.

courseGradesCsv(policy: Json, inputs: Json, sections: Seq, at: Date) : String
  Writes the final grades as CSV with CRLF line endings, quoting text that needs it.
```

```endpoints
Course.courseGrades.ClearOverride at /course-grades/clear-override
Course.courseGrades.CreatePolicy at /course-grades/create
Course.courseGrades.Export at /grades/export
Course.courseGrades.Hide at /course-grades/hide
Course.courseGrades.MarkFinal at /course-grades/mark-final
Course.courseGrades.Mine at /course-grades/mine
Course.courseGrades.Read at /course-grades/read
Course.courseGrades.ReadPolicy at /course-grades/policy
Course.courseGrades.ReadVersion at /course-grades/version
Course.courseGrades.Release at /course-grades/release
Course.courseGrades.ReleaseAgain at /course-grades/release
Course.courseGrades.ReleaseRefused at /course-grades/release
Course.courseGrades.RemovePolicy at /course-grades/remove
Course.courseGrades.RenamePolicy at /course-grades/rename
Course.courseGrades.SavePolicy at /course-grades/save
Course.courseGrades.SetOverride at /course-grades/override
Course.courseGrades.UpdateStudent at /course-grades/update-student
Course.courseGrades.UpdateStudentAgain at /course-grades/update-student
Course.courseGrades.UpdateStudentRefused at /course-grades/update-student
```
