# Assignments

Staff holding `course:manage` use
[Course.assignments.CreateDraft](reaction:Course.assignments.CreateDraft) to create an authored draft.
[Course.assignments.Revise](reaction:Course.assignments.Revise) replaces its authored fields while it remains
revisable. One authored field says whether each student or each section submits
the assignment. A draft created without it is submitted by each student. A
revision must state it, so a request that leaves it out is refused and changes
nothing, and staff may change it after publication. [Course.assignments.Publish](reaction:Course.assignments.Publish) moves a draft into its published, releasable
state. [Course.assignments.Archive](reaction:Course.assignments.Archive) moves an assignment out of its revisable
states.
[Course.assignments.SetDueOverride](reaction:Course.assignments.SetDueOverride) gives one released student an individual
due date. [Course.assignments.ClearDueOverride](reaction:Course.assignments.ClearDueOverride) removes only that student's individual
due-date override. When the assignment is submitted by each section and the
student's seat has one, both also write the release of every other current
member of that section, so staff set or clear a section's due date through any
member. [The due override that stands for a student](view:Course.assignments.theDueOverrideFor)
is their own; on an assignment submitted by each section, it is the latest
override among the section's current members, so a member whose release was
not written yet still reads a date set through a teammate.
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
[Course.assignments.ForMe](reaction:Course.assignments.ForMe): the due override
that stands for them on each one beside the assignment's title, kind, due and
close dates, and whether it accepts submissions, so one read lists the
student's work. The
[theAssignment view](view:Course.assignments.theAssignment) relates one release to its current
published assignment, so [Course.assignments.GetAssignment](reaction:Course.assignments.GetAssignment) returns detail
when [learner access](view:Course.assignments.mayReadLearnerAssignment) holds: a published assignment assigned to the active learner, or an archived assignment with their own released or excused assessment. Other work appears as `null`. The response also reports current `canSubmit` eligibility; historical access cannot permit new submissions. When the student's section submits the assignment, the response names [that section and its current members](former:Course.assignments.theTeamOf), so a member reads who shares the work; otherwise `team` is `null`. [Course.assignments.StaffSummary](reaction:Course.assignments.StaffSummary) gives callers with [staff detail access](view:Course.assignments.mayReadStaffAssignment) (`course:manage` or `grade`) the detail for one assignment. Assignment mutations remain restricted to course management. [Course.assignments.StaffList](reaction:Course.assignments.StaffList) gives the same callers
[all assignments](former:Course.assignments.theStaffAssignments), including drafts and archived work.

[Course.assignments.Submit](reaction:Course.assignments.Submit) creates a Posting post as the artifact and then
records a numbered Submitting attempt for the student. When the student's
submitter is their section,
[Course.assignments.SubmitForSection](reaction:Course.assignments.SubmitForSection) answers the same
request instead: the student authors the post, and the attempt is recorded for
the section, read again after the post exists. Any member may submit, and each
attempt takes the section's next number. If recording the attempt faults after
post creation, the post remains because the two owners are not transactional.
Submission eligibility is checked before artifact creation using the current
assignment policy described below.

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
Course.assignments.SubmitForSection at /assignments/submit
```

Each successful release triggers [AssignmentReleaseNotifiesStudent](reaction:Course.assignments.AssignmentReleaseNotifiesStudent).
It creates an assignment_released notification for the actual active student assignee, linked to the assignment. This covers targeted publication and later enrolment; drafts and revisions that do not create a new release do not notify. Assigning rejects duplicate releases for the same assignment and person.

[Submission eligibility](view:Course.assignments.maySubmitAssignment) requires an active learner, an assignment release, current audience membership, published accepting work, and the availability/close window. The close time is a hard boundary; due overrides and late-day use do not extend it. Invalid submission requests are refused before creating an artifact.
