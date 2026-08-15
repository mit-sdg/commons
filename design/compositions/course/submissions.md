# Submission reads

For an active student, [Course.submissions.Latest](reaction:Course.submissions.Latest) returns the
highest-numbered submitted attempt for one assignment or `null`.
[Course.submissions.Attempts](reaction:Course.submissions.Attempts) returns every attempt, including withdrawn ones
with their permanent numbers. Staff with `submissions:view-all` can make the
same reads for another active student. Other callers and inactive targets are
hidden as `NOT_FOUND`.

[Course.submissions.ForStudent](reaction:Course.submissions.ForStudent) returns attempts across assignments to that
student or authorized staff. [Course.submissions.ForAssignment](reaction:Course.submissions.ForAssignment) is staff-only
and places two current lists side by side: everyone holding an assignment
release, including due overrides, and every recorded attempt with its roster
name. It does not collapse attempts or infer that each submitter was assigned.

Attempt creation belongs to assignment behavior. Submitting treats assignment
and artifact identities as opaque, so these reads report retained attempt state
without revalidating publication, release, dates, or the current existence of an
artifact.

## Supporting declarations

Views [theLatestSubmission](view:Course.submissions.theLatestSubmission) support the behavior and result shapes described above.

Formers [theAssignedPopulationForAssignment](former:Course.submissions.theAssignedPopulationForAssignment), [theAttempts](former:Course.submissions.theAttempts), [theSubmissionsBy](former:Course.submissions.theSubmissionsBy), [theSubmissionsForAssignment](former:Course.submissions.theSubmissionsForAssignment) support the behavior and result shapes described above.
