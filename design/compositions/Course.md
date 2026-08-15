# Course

Course composition coordinates membership, assigned work, learner attempts,
grades, late-day allowances, staff notes, and calendar presentation. Access
policy first establishes whether the active user acts as a learner or as staff.

## Compositions

### Roster

Rostering seats connect external course records to application users. Claiming a
staff seat grants the corresponding course role; dropping it revokes that role.
Profiling remains the owner of the user's presentation and contact details.

### Assignments and submissions

Assigning owns assignment publication and releases. Composition derives the
released learner population from roster sections, permits Submitting only for an
eligible release, and keeps assignment policy out of submission state.

### Grades

Published, submission-accepting assignments establish Itemizing grade items.
Grading owns criteria, scores, and release state; composition controls staff
changes and separates released learner results from the working gradebook.

### Late days

Banking owns balances and per-assignment use. Course policy identifies the
learner and staff operations allowed to change those balances without making
Banking depend on roster or assignment state.

### Notes and calendar

Noting records staff observations with their own visibility lifecycle. Calendar
and dashboard reads combine roster, assignment, grade, late-day, and note state
at request time rather than maintaining another course model.

## Views

Course views name release eligibility, submission ownership, learner identity,
and note visibility where those decisions are shared across operations.

## Formers

Course formers build roster, assignment, gradebook, note, calendar, and dashboard
results directly from current concept queries.

## Declaration coverage

The following executable declarations implement the application decisions described in this document.

### Reaction declarations

- [`Course.assignments.Archive`](reaction:Course.assignments.Archive) supports the course composition described above.
- [`Course.assignments.ClaimedStudentSeatReceivesPublished`](reaction:Course.assignments.ClaimedStudentSeatReceivesPublished) supports the course composition described above.
- [`Course.assignments.ClearDueOverride`](reaction:Course.assignments.ClearDueOverride) supports the course composition described above.
- [`Course.assignments.CreateDraft`](reaction:Course.assignments.CreateDraft) supports the course composition described above.
- [`Course.assignments.ForMe`](reaction:Course.assignments.ForMe) supports the course composition described above.
- [`Course.assignments.GetAssignment`](reaction:Course.assignments.GetAssignment) supports the course composition described above.
- [`Course.assignments.Publish`](reaction:Course.assignments.Publish) supports the course composition described above.
- [`Course.assignments.PublishedAcceptingAssignmentGetsGradeItem`](reaction:Course.assignments.PublishedAcceptingAssignmentGetsGradeItem) supports the course composition described above.
- [`Course.assignments.PublishedAssignmentAssignsAudienceStudents`](reaction:Course.assignments.PublishedAssignmentAssignsAudienceStudents) supports the course composition described above.
- [`Course.assignments.ReinstatedStudentSeatReceivesPublished`](reaction:Course.assignments.ReinstatedStudentSeatReceivesPublished) supports the course composition described above.
- [`Course.assignments.Revise`](reaction:Course.assignments.Revise) supports the course composition described above.
- [`Course.assignments.RevisedAssignmentAssignsNewAudienceStudents`](reaction:Course.assignments.RevisedAssignmentAssignsNewAudienceStudents) supports the course composition described above.
- [`Course.assignments.SetDueOverride`](reaction:Course.assignments.SetDueOverride) supports the course composition described above.
- [`Course.assignments.StaffList`](reaction:Course.assignments.StaffList) supports the course composition described above.
- [`Course.assignments.StaffSummary`](reaction:Course.assignments.StaffSummary) supports the course composition described above.
- [`Course.assignments.Submit`](reaction:Course.assignments.Submit) supports the course composition described above.
- [`Course.calendar.CalendarMe`](reaction:Course.calendar.CalendarMe) supports the course composition described above.
- [`Course.calendar.CalendarStaff`](reaction:Course.calendar.CalendarStaff) supports the course composition described above.
- [`Course.calendar.LmsMe`](reaction:Course.calendar.LmsMe) supports the course composition described above.
- [`Course.calendar.LmsStaffDashboard`](reaction:Course.calendar.LmsStaffDashboard) supports the course composition described above.
- [`Course.grades.GradesAddCriterion`](reaction:Course.grades.GradesAddCriterion) supports the course composition described above.
- [`Course.grades.GradesConfigureItem`](reaction:Course.grades.GradesConfigureItem) supports the course composition described above.
- [`Course.grades.GradesCriterionScores`](reaction:Course.grades.GradesCriterionScores) supports the course composition described above.
- [`Course.grades.GradesExcuse`](reaction:Course.grades.GradesExcuse) supports the course composition described above.
- [`Course.grades.GradesExport`](reaction:Course.grades.GradesExport) supports the course composition described above.
- [`Course.grades.GradesForItem`](reaction:Course.grades.GradesForItem) supports the course composition described above.
- [`Course.grades.GradesForMe`](reaction:Course.grades.GradesForMe) supports the course composition described above.
- [`Course.grades.GradesForStudent`](reaction:Course.grades.GradesForStudent) supports the course composition described above.
- [`Course.grades.GradesGradebook`](reaction:Course.grades.GradesGradebook) supports the course composition described above.
- [`Course.grades.GradesItem`](reaction:Course.grades.GradesItem) supports the course composition described above.
- [`Course.grades.GradesRecord`](reaction:Course.grades.GradesRecord) supports the course composition described above.
- [`Course.grades.GradesRelease`](reaction:Course.grades.GradesRelease) supports the course composition described above.
- [`Course.grades.GradesReleaseItem`](reaction:Course.grades.GradesReleaseItem) supports the course composition described above.
- [`Course.grades.GradesRemoveCriterion`](reaction:Course.grades.GradesRemoveCriterion) supports the course composition described above.
- [`Course.grades.GradesRetract`](reaction:Course.grades.GradesRetract) supports the course composition described above.
- [`Course.grades.GradesReviseCriterion`](reaction:Course.grades.GradesReviseCriterion) supports the course composition described above.
- [`Course.grades.GradesScoreCriterion`](reaction:Course.grades.GradesScoreCriterion) supports the course composition described above.
- [`Course.grades.RemovedCriterionClearsScores`](reaction:Course.grades.RemovedCriterionClearsScores) supports the course composition described above.
- [`Course.grades.RevisedAcceptingAssignmentEnsuresGradeItem`](reaction:Course.grades.RevisedAcceptingAssignmentEnsuresGradeItem) supports the course composition described above.
- [`Course.lateDays.Apply`](reaction:Course.lateDays.Apply) supports the course composition described above.
- [`Course.lateDays.Balance`](reaction:Course.lateDays.Balance) supports the course composition described above.
- [`Course.lateDays.Cancel`](reaction:Course.lateDays.Cancel) supports the course composition described above.
- [`Course.lateDays.Change`](reaction:Course.lateDays.Change) supports the course composition described above.
- [`Course.lateDays.ConfigurePolicy`](reaction:Course.lateDays.ConfigurePolicy) supports the course composition described above.
- [`Course.lateDays.ForAssignment`](reaction:Course.lateDays.ForAssignment) supports the course composition described above.
- [`Course.lateDays.Grant`](reaction:Course.lateDays.Grant) supports the course composition described above.
- [`Course.lateDays.List`](reaction:Course.lateDays.List) supports the course composition described above.
- [`Course.lateDays.Policy`](reaction:Course.lateDays.Policy) supports the course composition described above.
- [`Course.lateDays.StaffCancel`](reaction:Course.lateDays.StaffCancel) supports the course composition described above.
- [`Course.lateDays.StaffChange`](reaction:Course.lateDays.StaffChange) supports the course composition described above.
- [`Course.notes.Acknowledge`](reaction:Course.notes.Acknowledge) supports the course composition described above.
- [`Course.notes.Archive`](reaction:Course.notes.Archive) supports the course composition described above.
- [`Course.notes.NotesList`](reaction:Course.notes.NotesList) supports the course composition described above.
- [`Course.notes.NotesVisible`](reaction:Course.notes.NotesVisible) supports the course composition described above.
- [`Course.notes.Resolve`](reaction:Course.notes.Resolve) supports the course composition described above.
- [`Course.notes.Restore`](reaction:Course.notes.Restore) supports the course composition described above.
- [`Course.notes.Revise`](reaction:Course.notes.Revise) supports the course composition described above.
- [`Course.notes.StudentsDetail`](reaction:Course.notes.StudentsDetail) supports the course composition described above.
- [`Course.notes.Write`](reaction:Course.notes.Write) supports the course composition described above.
- [`Course.roster.ClaimSeat`](reaction:Course.roster.ClaimSeat) supports the course composition described above.
- [`Course.roster.ClassConfiguration`](reaction:Course.roster.ClassConfiguration) supports the course composition described above.
- [`Course.roster.ConfigureClass`](reaction:Course.roster.ConfigureClass) supports the course composition described above.
- [`Course.roster.DroppedRoster`](reaction:Course.roster.DroppedRoster) supports the course composition described above.
- [`Course.roster.DroppedStaffSeatRevokesCourseStaff`](reaction:Course.roster.DroppedStaffSeatRevokesCourseStaff) supports the course composition described above.
- [`Course.roster.DropSeat`](reaction:Course.roster.DropSeat) supports the course composition described above.
- [`Course.roster.ImportPreview`](reaction:Course.roster.ImportPreview) supports the course composition described above.
- [`Course.roster.ImportSeats`](reaction:Course.roster.ImportSeats) supports the course composition described above.
- [`Course.roster.LinkUser`](reaction:Course.roster.LinkUser) supports the course composition described above.
- [`Course.roster.MoveSection`](reaction:Course.roster.MoveSection) supports the course composition described above.
- [`Course.roster.PendingRoster`](reaction:Course.roster.PendingRoster) supports the course composition described above.
- [`Course.roster.ReinstateSeat`](reaction:Course.roster.ReinstateSeat) supports the course composition described above.
- [`Course.roster.RosterList`](reaction:Course.roster.RosterList) supports the course composition described above.
- [`Course.roster.RosterMe`](reaction:Course.roster.RosterMe) supports the course composition described above.
- [`Course.roster.SectionsCreate`](reaction:Course.roster.SectionsCreate) supports the course composition described above.
- [`Course.roster.SectionsList`](reaction:Course.roster.SectionsList) supports the course composition described above.
- [`Course.roster.SectionsUpdate`](reaction:Course.roster.SectionsUpdate) supports the course composition described above.
- [`Course.roster.StaffSeatGrantsCourseStaff`](reaction:Course.roster.StaffSeatGrantsCourseStaff) supports the course composition described above.
- [`Course.submissions.Attempts`](reaction:Course.submissions.Attempts) supports the course composition described above.
- [`Course.submissions.ForAssignment`](reaction:Course.submissions.ForAssignment) supports the course composition described above.
- [`Course.submissions.ForStudent`](reaction:Course.submissions.ForStudent) supports the course composition described above.
- [`Course.submissions.Latest`](reaction:Course.submissions.Latest) supports the course composition described above.

### View declarations

- [`Course.assignments.theAssignment`](view:Course.assignments.theAssignment) supports the course composition described above.
- [`Course.notes.theSeatDetailOf`](view:Course.notes.theSeatDetailOf) supports the course composition described above.
- [`Course.roster.identityMatchedSeat`](view:Course.roster.identityMatchedSeat) supports the course composition described above.
- [`Course.roster.theClassConfiguration`](view:Course.roster.theClassConfiguration) supports the course composition described above.
- [`Course.roster.theSeatOf`](view:Course.roster.theSeatOf) supports the course composition described above.
- [`Course.submissions.theLatestSubmission`](view:Course.submissions.theLatestSubmission) supports the course composition described above.

### Former declarations

- [`Course.assignments.theAssignmentsOf`](former:Course.assignments.theAssignmentsOf) supports the course composition described above.
- [`Course.assignments.theStaffAssignments`](former:Course.assignments.theStaffAssignments) supports the course composition described above.
- [`Course.calendar.theCalendarBetween`](former:Course.calendar.theCalendarBetween) supports the course composition described above.
- [`Course.calendar.theDashboardSeatOf`](former:Course.calendar.theDashboardSeatOf) supports the course composition described above.
- [`Course.calendar.theStaffDashboard`](former:Course.calendar.theStaffDashboard) supports the course composition described above.
- [`Course.calendar.theStaffDashboardCounts`](former:Course.calendar.theStaffDashboardCounts) supports the course composition described above.
- [`Course.grades.theCriteriaOf`](former:Course.grades.theCriteriaOf) supports the course composition described above.
- [`Course.grades.theCriterionScoresOf`](former:Course.grades.theCriterionScoresOf) supports the course composition described above.
- [`Course.grades.theGradebook`](former:Course.grades.theGradebook) supports the course composition described above.
- [`Course.grades.theGradebookLearners`](former:Course.grades.theGradebookLearners) supports the course composition described above.
- [`Course.grades.theGradesOf`](former:Course.grades.theGradesOf) supports the course composition described above.
- [`Course.grades.theGradesOn`](former:Course.grades.theGradesOn) supports the course composition described above.
- [`Course.grades.theReleasedGradesOf`](former:Course.grades.theReleasedGradesOf) supports the course composition described above.
- [`Course.lateDays.theLateDayBalanceOf`](former:Course.lateDays.theLateDayBalanceOf) supports the course composition described above.
- [`Course.lateDays.theLateDayUsesOf`](former:Course.lateDays.theLateDayUsesOf) supports the course composition described above.
- [`Course.lateDays.theLateDayUsesOn`](former:Course.lateDays.theLateDayUsesOn) supports the course composition described above.
- [`Course.notes.theNotesShownTo`](former:Course.notes.theNotesShownTo) supports the course composition described above.
- [`Course.notes.theStaffNotesOn`](former:Course.notes.theStaffNotesOn) supports the course composition described above.
- [`Course.roster.theDroppedRoster`](former:Course.roster.theDroppedRoster) supports the course composition described above.
- [`Course.roster.thePendingRoster`](former:Course.roster.thePendingRoster) supports the course composition described above.
- [`Course.roster.theRoster`](former:Course.roster.theRoster) supports the course composition described above.
- [`Course.roster.theSections`](former:Course.roster.theSections) supports the course composition described above.
- [`Course.submissions.theAssignedPopulationForAssignment`](former:Course.submissions.theAssignedPopulationForAssignment) supports the course composition described above.
- [`Course.submissions.theAttempts`](former:Course.submissions.theAttempts) supports the course composition described above.
- [`Course.submissions.theSubmissionsBy`](former:Course.submissions.theSubmissionsBy) supports the course composition described above.
- [`Course.submissions.theSubmissionsForAssignment`](former:Course.submissions.theSubmissionsForAssignment) supports the course composition described above.
