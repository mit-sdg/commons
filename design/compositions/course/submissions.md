# Submission reads

The [theLatestSubmission view](view:Course.submissions.theLatestSubmission) selects the highest-numbered
submitted attempt for one assignment and student. For an active student,
[Course.submissions.Latest](reaction:Course.submissions.Latest) returns that attempt or `null`.
[Course.submissions.Attempts](reaction:Course.submissions.Attempts) forms
[every numbered attempt](former:Course.submissions.theAttempts), including withdrawn ones
with their permanent numbers. A caller who may grade that student's work on the
assignment can make the same reads for another active student. Other callers and
inactive targets are hidden as `NOT_FOUND`.

A grader who is also an active student sees only the work of the classmates
Delegating names them for on each assignment, and never their own as a grader.

The [submissionHasArtifact view](view:Course.submissions.submissionHasArtifact) verifies that an artifact belongs to one student's attempt on one assignment. The [mayReadSubmissionArtifact view](view:Course.submissions.mayReadSubmissionArtifact) admits an active student for their own artifact or a caller who may grade the named student's work on the assignment. [Course.submissions.Artifact](reaction:Course.submissions.Artifact) uses both decisions to return the rendered artifact or `NOT_FOUND`; forum post reads never expose submission artifacts.

[Course.submissions.ForStudent](reaction:Course.submissions.ForStudent) forms
[attempts across assignments](former:Course.submissions.theSubmissionsBy) for that student, and for a caller holding `grade`
[only the attempts on assignments they may grade that student on](former:Course.submissions.theGradableSubmissionsBy).
[Course.submissions.ForAssignment](reaction:Course.submissions.ForAssignment) requires `grade` and places two current lists side by side, each keeping only the learners the caller may grade:
[everyone holding an assignment release](former:Course.submissions.theAssignedPopulationForAssignment), including due overrides, the learner's seat standing so a dropped learner can be told apart, and the learner's profile name, username, roster email, and section for staff exports,
and [every recorded attempt beside its submitter's profile display name](former:Course.submissions.theSubmissionsForAssignment), including the artifact identities needed to open its evidence. The profile is where a submitter's name comes from now that a seat records none. It does not collapse attempts or infer that each submitter was assigned.

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
