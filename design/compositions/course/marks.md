# Point grades

Point grades use the Grading concept's current `POINTS` configuration and one
assignment-level score per learner. A score snapshots its denominator. Blank UI
input creates no mark; numeric zero and finite decimals are valid. Drafts remain
staff-only, while released and excused records are visible to their learner.

Every write is authorized through the instance-wide `grade` capability. Creating
a mark or rebinding its evidence requires active enrollment, assigned published
work that accepts submissions, and the learner's submitted evidence. A new
excusal may instead use the empty evidence marker. Existing marks can be corrected
after the assignment or enrollment becomes inactive when learner, item, and
evidence remain unchanged. Numeric correction requires nonempty evidence, so an
unscored no-submission excusal cannot become a score without supporting work.
Existing excusals may still be restored and re-excused with their unchanged empty
evidence. Record versions prevent concurrent overwrites. The configuration
generation prevents a delayed request from writing after a method or maximum
change, including after a later switch back to points.

[Require eligible assigned work in the current points mode](view:Course.marks.mayMarkWork).
[Allow either eligible work or an explicit no-submission excusal](view:Course.marks.mayExcuseWork).
[Allow correction of an existing mark only with its unchanged nonempty evidence](view:Course.marks.mayCorrectMark).
[Allow an existing mark to be re-excused only with its unchanged identity and evidence](view:Course.marks.mayCorrectExcusal).
[Allow new eligible scores or safe corrections of an existing score](view:Course.marks.mayRecordMark).
[Allow new eligible excusals or safe re-excusal of an existing mark](view:Course.marks.mayExcuseMark).

[Save an assignment-level numeric draft at its observed version](reaction:Course.marks.MarksRecord).

[Release one scored draft](reaction:Course.marks.MarksRelease).

[Retract one released point grade](reaction:Course.marks.MarksRetract).

[Restore one excused point grade to draft](reaction:Course.marks.MarksRestoreExcused).

[Excuse assigned work with or without an entered score](reaction:Course.marks.MarksExcuse).

[Release scored drafts and report incomplete, changed, or unconfirmed outcomes](reaction:Course.marks.MarksReleaseItem).

[Read every current point grade on an item as staff](reaction:Course.marks.MarksForItem).

[Read one learner's current point grades as staff](reaction:Course.marks.MarksForStudent).

[Read the signed-in learner's released and excused point grades](reaction:Course.marks.MarksForMe).

```endpoints
Course.marks.MarksRecord at /marks/record
Course.marks.MarksRelease at /marks/release
Course.marks.MarksRetract at /marks/retract
Course.marks.MarksRestoreExcused at /marks/restore-excused
Course.marks.MarksExcuse at /marks/excuse
Course.marks.MarksReleaseItem at /marks/release-item
Course.marks.MarksForItem at /marks/for-item
Course.marks.MarksForStudent at /marks/for-student
Course.marks.MarksForMe at /marks/for-me
```
