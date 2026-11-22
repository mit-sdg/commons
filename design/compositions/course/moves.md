# Moving earlier submissions to sections

Staff may change a published assignment to be submitted by each section after
students have submitted and been graded one by one. From then on the pages read
each section's work, so those earlier attempts are no longer shown. One route
copies them to the sections.

Sam and Maya share a section and each submitted the pitch; Sam's was graded.
Dana changes the pitch to each section and moves the earlier submissions. The
section now has two attempts, Sam's and then Maya's, each with its paper and
its original time, and a draft assessment on the first with Sam's ratings,
feedback, and grader. Dana reads the draft and releases it, and Sam, Maya, and
their section-mates all read the grade. Sam's own attempt and assessment stay
stored with their history.

[The attempts not yet moved](view:Course.moves.theUnmovedAttempts) are the
submitted attempts of active students whose submitter is their section, for
which [no other submitter has an attempt holding the same artifact](view:Course.moves.heldByAnother). An attempt is moved
once. Ben's pitch is moved to his section, and Ben is later moved to another
section: the copy stays where it is, and his pitch is not offered to the new
section, where it would become that section's latest attempt. An attempt is
also left where it is when [its section already holds a later one](view:Course.moves.hasLaterAttempt):
Maya submits for the section before Dana presses the move, so Sam's older pitch
is not offered, because its copy would take the next number and stand as the
section's latest. The same holds for a student placed in a section after it
has submitted.
The staff read of one assignment's submissions, `Course.submissions.ForAssignment`,
lists [those the caller may grade](former:Course.moves.theUnmovedSubmissions),
so a page can offer the move while any remain and say how many attempts and
sections it covers.

[Course.moves.MoveToSections](reaction:Course.moves.MoveToSections) needs
`course:manage`. For each unmoved attempt it calls `Submitting.submit` for the
section with the attempt's [one artifact](computation:soleArtifact) and its
original time, so the section's attempts are numbered in the order they were
submitted.

After those attempts exist,
[Course.moves.MoveCopiesGrades](reaction:Course.moves.MoveCopiesGrades) copies
[each assessment not yet copied](view:Course.moves.theUncopiedGrades): a draft
or released assessment of a member's own attempt whose copy has no assessment,
or one still at its first version. It calls `Grading.record` on the copy with
the original criteria, method, setup revision, and grader, and then
`Grading.save` with the original judgments and feedback. The copy is a draft;
staff release it with the existing release, which lets them see two members'
differing grades on one section before students do. An excused assessment is
not copied.

[Course.moves.MoveAnswers](reaction:Course.moves.MoveAnswers) answers once
nothing is left to move or copy.
[Course.moves.MoveRefusals](reaction:Course.moves.MoveRefusals) answers
`NOT_FOUND` for an unknown assignment and `FORBIDDEN` for a caller without
`course:manage`.

A second request writes nothing: a moved attempt is no longer unmoved, and a
saved copy is past its first version. A copy that staff edited is past its
first version too, so it is never overwritten. A copy that was recorded but not
saved, as after a fault, is saved by the next request. Grading delegations are
not moved. An assignment submitted by each student has nothing to move.

```endpoints
Course.moves.MoveAnswers at /submissions/move-to-sections
Course.moves.MoveCopiesGrades at /submissions/move-to-sections
Course.moves.MoveRefusals at /submissions/move-to-sections
Course.moves.MoveToSections at /submissions/move-to-sections
```
