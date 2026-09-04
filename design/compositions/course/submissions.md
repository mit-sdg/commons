# Submission reads

The [theLatestSubmission view](view:Course.submissions.theLatestSubmission) selects the highest-numbered
submitted attempt for one assignment and student. For an active student,
[Course.submissions.Latest](reaction:Course.submissions.Latest) returns that attempt or `null`.
[Course.submissions.Attempts](reaction:Course.submissions.Attempts) forms
[every numbered attempt](former:Course.submissions.theAttempts), including withdrawn ones
with their permanent numbers. Staff with `grade` can make the
same reads for another active student. Other callers and inactive targets are
hidden as `NOT_FOUND`.

The [submissionHasArtifact view](view:Course.submissions.submissionHasArtifact) verifies that an artifact belongs to one student's attempt on one assignment. The [mayReadSubmissionArtifact view](view:Course.submissions.mayReadSubmissionArtifact) admits an active student for their own artifact or a caller holding `grade` for the named student. [Course.submissions.Artifact](reaction:Course.submissions.Artifact) uses both decisions to return the rendered artifact or `NOT_FOUND`; forum post reads never expose submission artifacts.

[Course.submissions.ForStudent](reaction:Course.submissions.ForStudent) forms
[attempts across assignments](former:Course.submissions.theSubmissionsBy) for that student or a caller holding `grade`.
[Course.submissions.ForAssignment](reaction:Course.submissions.ForAssignment) requires `grade` and places two current lists side by side:
[everyone holding an assignment release](former:Course.submissions.theAssignedPopulationForAssignment), including due overrides,
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
