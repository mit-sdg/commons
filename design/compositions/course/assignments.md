# Assignments

Staff with assignment-management capability use
[Course.assignments.CreateDraft](reaction:Course.assignments.CreateDraft) to create an authored draft.
[Course.assignments.Revise](reaction:Course.assignments.Revise) replaces its authored fields while it remains
revisable. [Course.assignments.Publish](reaction:Course.assignments.Publish) moves a draft into its published, releasable
state. [Course.assignments.Archive](reaction:Course.assignments.Archive) moves an assignment out of its revisable
states.
[Course.assignments.SetDueOverride](reaction:Course.assignments.SetDueOverride) gives one released student an individual
due date. [Course.assignments.ClearDueOverride](reaction:Course.assignments.ClearDueOverride) removes only that student's individual
due-date override.
All of these operations derive the actor from the live session and leave
Assigning's own refusals in force.

After publication,
[Course.assignments.PublishedAssignmentAssignsAudienceStudents](reaction:Course.assignments.PublishedAssignmentAssignsAudienceStudents) gives a
release to every active student when the audience is everyone, or to active
students in the selected sections when the audience is targeted. Revising a
published assignment triggers
[Course.assignments.RevisedAssignmentAssignsNewAudienceStudents](reaction:Course.assignments.RevisedAssignmentAssignsNewAudienceStudents), which adds
missing releases for newly covered students but does not remove existing
releases when the audience narrows.

Roster changes feed the same release model. After a student claims a seat,
[Course.assignments.ClaimedStudentSeatReceivesPublished](reaction:Course.assignments.ClaimedStudentSeatReceivesPublished) assigns every
published assignment matching that section or the whole class. After a dropped
student seat is reinstated,
[Course.assignments.ReinstatedStudentSeatReceivesPublished](reaction:Course.assignments.ReinstatedStudentSeatReceivesPublished) does likewise.
Each assignment is a separate follow-up action: the publish, revision, claim, or
reinstatement remains committed if part of the fan-out refuses or faults, and a
later roster or assignment change is the only automatic retry opportunity.

An active student reads their published releases with
[Course.assignments.ForMe](reaction:Course.assignments.ForMe). [Course.assignments.GetAssignment](reaction:Course.assignments.GetAssignment) returns detail
only when that student has a release and the assignment is still published;
unassigned and unpublished work appears as `null`. [Course.assignments.StaffSummary](reaction:Course.assignments.StaffSummary) gives assignment managers the detail for
one assignment. [Course.assignments.StaffList](reaction:Course.assignments.StaffList) gives assignment managers all assignments,
including drafts and archived work.

[Course.assignments.Submit](reaction:Course.assignments.Submit) creates a Posting post as the artifact and then
records a numbered Submitting attempt. If recording the attempt faults after
post creation, the post remains because the two owners are not transactional.
Submission checks only that the caller has an active student seat. The supplied
assignment need not exist, be published, be released to that student, be open by
date, or accept submissions.

## Supporting declarations

Views [theAssignment](view:Course.assignments.theAssignment) support the behavior and result shapes described above.

Formers [theAssignmentsOf](former:Course.assignments.theAssignmentsOf), [theStaffAssignments](former:Course.assignments.theStaffAssignments) support the behavior and result shapes described above.
