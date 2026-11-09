# Course grades

Course staff turn released competency ratings into a course grade. A policy
says how: the value of each rating and of missing work, what late work without
late days counts as, groups of assignments or skills with their weights, an
attendance rule, and the grade lines. Staff try policies side by side, record
the few judgments a policy can't make as overrides, and download the final
grades.

## Who reads and changes what

The page shows every student's average and rank, so it is read by a caller
holding `grade` who is not enrolled as an active student; the same rule
guards the staff gradebook. Changing policies and overrides, and downloading,
needs `grade-policies` as well as reading the page. Administrators hold both
through `administer`.

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
calculation the server runs for overrides and the download.

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

## Releases and the download

Course grades are not released to students from this page. The releases and
the standing updates the page reads are editions of the reserved material
`course-grades`, or of one student, in CourseGradePublishing, with what each
released kept in CourseGradeSnapshotting. No endpoint publishes one.

[Course.courseGrades.Export](reaction:Course.courseGrades.Export) writes the
final grades as CSV with [courseGradesCsv](computation:courseGradesCsv): one
row per active student under [the final policy](view:Course.courseGrades.theFinalPolicy) as of now, with name, email,
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






releaseSummary(value: CourseGradeRelease) : Json
  Answers what staff see of a release or an update: every card and who was held, without the inputs.

courseGradesCsv(policy: Json, inputs: Json, sections: Seq, at: Date) : String
  Writes the final grades as CSV with CRLF line endings, quoting text that needs it.
```

```endpoints
Course.courseGrades.ClearOverride at /course-grades/clear-override
Course.courseGrades.CreatePolicy at /course-grades/create
Course.courseGrades.Export at /grades/export
Course.courseGrades.MarkFinal at /course-grades/mark-final
Course.courseGrades.Read at /course-grades/read
Course.courseGrades.ReadPolicy at /course-grades/policy
Course.courseGrades.ReadVersion at /course-grades/version
Course.courseGrades.RemovePolicy at /course-grades/remove
Course.courseGrades.RenamePolicy at /course-grades/rename
Course.courseGrades.SavePolicy at /course-grades/save
Course.courseGrades.SetOverride at /course-grades/override
```
