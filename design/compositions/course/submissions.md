# Submission reads

An assignment is submitted by each student or by each section. The submitter
for a student on an assignment is their section when the assignment is
submitted by each section and their seat has one, and the student otherwise.
The `theSubmitterFor` view in the access policy answers this with the
[submitterFor](computation:submitterFor) computation, and every read on this
page starts from it. A request names the student whose work is wanted, never a
section. Sam, Maya, and Ada share a section: when Sam submits the final
project, all three read the same attempts. Ben is moved into their section and
reads those attempts too, and no longer his old section's. Leo is in no
section and reads his own.

The [theLatestSubmission view](view:Course.submissions.theLatestSubmission) selects the submitter's
highest-numbered submitted attempt for one assignment and student. For an active student,
[Course.submissions.Latest](reaction:Course.submissions.Latest) returns that attempt or `null`.
[Course.submissions.Attempts](reaction:Course.submissions.Attempts) forms
[every numbered attempt](former:Course.submissions.theAttempts) of
[the submitter](view:Course.submissions.theStandingAttempts), including withdrawn ones
with their permanent numbers. A caller who may grade that student's work on the
assignment can make the same reads for another active student. Other callers and
inactive targets are hidden as `NOT_FOUND`.

A grader who is also an active student sees only the work Delegating names
them for on each assignment, and never their own or their section's as a
grader.

An attempt a student made before the assignment was changed to each section
stays in Submitting. While the student has a section, these reads return the
section's attempts and not that earlier one.

The [submissionHasArtifact view](view:Course.submissions.submissionHasArtifact) verifies that an artifact belongs to one submitter's attempt on one assignment. The [mayReadSubmissionArtifact view](view:Course.submissions.mayReadSubmissionArtifact) admits an active student for an artifact of their own submitter, so a student reads a paper a section-mate handed in, or a caller who may grade the named student's work on the assignment. The artifact's author is the person who handed it in. [Course.submissions.Artifact](reaction:Course.submissions.Artifact) uses both decisions to return the rendered artifact or `NOT_FOUND`; forum post reads never expose submission artifacts.

[Course.submissions.ForStudent](reaction:Course.submissions.ForStudent) forms
[attempts across assignments](former:Course.submissions.theSubmissionsBy) for that student from
[their own attempts where they submit and their section's where the section does](view:Course.submissions.theStandingSubmissions), and for a caller holding `grade`
[only the attempts on assignments they may grade that student on](former:Course.submissions.theGradableSubmissionsBy).
[Course.submissions.ForAssignment](reaction:Course.submissions.ForAssignment) requires `grade` and places two current lists side by side, each keeping only the learners the caller may grade:
[everyone holding an assignment release](former:Course.submissions.theAssignedPopulationForAssignment), including who submits for each, due overrides, the learner's seat standing so a dropped learner can be told apart, and the learner's profile name, username, roster email, and section for staff exports,
and [every recorded attempt beside its submitter's profile display name](former:Course.submissions.theSubmissionsForAssignment), including the artifact identities needed to open its evidence. The profile is where a student's name comes from now that a seat records none; an attempt submitted by a section has no profile name, and the first list names the section's members. The second list does not collapse attempts or infer that each submitter was assigned, so a reader pairs an attempt with the students whose submitter it names.

Attempt creation belongs to assignment behavior. Submitting treats assignment
and artifact identities as opaque, so these reads report retained attempt state
without revalidating publication, release, dates, or the current existence of an
artifact.

```endpoints
Course.submissions.Attempts at /submissions/attempts
Course.submissions.Artifact at /submissions/artifact
Course.submissions.ForAssignment at /submissions/for-assignment
Course.submissions.ForStudent at /submissions/for-student
Course.submissions.Latest at /submissions/latest
```

[Artifact presentation](former:Course.submissions.theArtifactPost) uses assignment submission authorization independently of forum audiences.
