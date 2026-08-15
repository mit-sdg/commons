# Submission reads

The [theLatestSubmission view](view:Course.submissions.theLatestSubmission) selects the highest-numbered
submitted attempt for one assignment and student. For an active student,
[Course.submissions.Latest](reaction:Course.submissions.Latest) returns that attempt or `null`.
[Course.submissions.Attempts](reaction:Course.submissions.Attempts) forms
[every numbered attempt](former:Course.submissions.theAttempts), including withdrawn ones
with their permanent numbers. Staff with `submissions:view-all` can make the
same reads for another active student. Other callers and inactive targets are
hidden as `NOT_FOUND`.

[Course.submissions.ForStudent](reaction:Course.submissions.ForStudent) forms
[attempts across assignments](former:Course.submissions.theSubmissionsBy) for that student or authorized staff.
[Course.submissions.ForAssignment](reaction:Course.submissions.ForAssignment) is staff-only and places two current lists side by side:
[everyone holding an assignment release](former:Course.submissions.theAssignedPopulationForAssignment), including due overrides,
and [every recorded attempt with its roster name](former:Course.submissions.theSubmissionsForAssignment). It does not collapse attempts or infer that each submitter was assigned.

Attempt creation belongs to assignment behavior. Submitting treats assignment
and artifact identities as opaque, so these reads report retained attempt state
without revalidating publication, release, dates, or the current existence of an
artifact.
