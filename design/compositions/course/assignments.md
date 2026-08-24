# Assignments

Staff holding `course:manage` use
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

An active student reads
[their published releases](former:Course.assignments.theAssignmentsOf) with
[Course.assignments.ForMe](reaction:Course.assignments.ForMe). The
[theAssignment view](view:Course.assignments.theAssignment) relates one release to its current
published assignment, so [Course.assignments.GetAssignment](reaction:Course.assignments.GetAssignment) returns detail
only when that student has a release and the assignment is still published;
unassigned and unpublished work appears as `null`. [Course.assignments.StaffSummary](reaction:Course.assignments.StaffSummary) gives callers holding `course:manage` the detail for
one assignment. [Course.assignments.StaffList](reaction:Course.assignments.StaffList) gives the same callers
[all assignments](former:Course.assignments.theStaffAssignments), including drafts and archived work.

[Course.assignments.Submit](reaction:Course.assignments.Submit) creates a Posting post as the artifact and then
records a numbered Submitting attempt. If recording the attempt faults after
post creation, the post remains because the two owners are not transactional.
Submission checks only that the caller has an active student seat. The supplied
assignment need not exist, be published, be released to that student, be open by
date, or accept submissions.

```endpoints
Course.assignments.Archive at /assignments/archive
Course.assignments.ClearDueOverride at /assignments/clear-due-override
Course.assignments.CreateDraft at /assignments/create-draft
Course.assignments.ForMe at /assignments/for-me
Course.assignments.GetAssignment at /assignments/get
Course.assignments.Publish at /assignments/publish
Course.assignments.Revise at /assignments/revise
Course.assignments.SetDueOverride at /assignments/set-due-override
Course.assignments.StaffList at /assignments/staff-list
Course.assignments.StaffSummary at /assignments/staff-summary
Course.assignments.Submit at /assignments/submit
```
