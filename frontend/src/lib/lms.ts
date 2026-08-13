import type { Output } from "@/lib/api";
import { api, unwrap } from "@/lib/api";

export async function loadStudentDashboard(): Promise<Output<"/lms/me">> {
  return unwrap(await api.lms.me({}));
}

export async function loadStaffDashboard(): Promise<
  Output<"/lms/staff-dashboard">
> {
  return unwrap(await api.lms["staff-dashboard"]({}));
}

export async function loadRosterMe(): Promise<Output<"/roster/me">> {
  return unwrap(await api.roster.me({}));
}

export async function loadRosterList(): Promise<Output<"/roster/list">> {
  return unwrap(await api.roster.list({}));
}

export async function loadClassConfiguration(): Promise<
  Output<"/roster/class">
> {
  return unwrap(await api.roster.class({}));
}

export async function loadPendingRoster(): Promise<Output<"/roster/pending">> {
  return unwrap(await api.roster.pending({}));
}

export async function loadDroppedRoster(): Promise<Output<"/roster/dropped">> {
  return unwrap(await api.roster.dropped({}));
}

export async function loadSections(): Promise<Output<"/roster/sections/list">> {
  return unwrap(await api.roster["sections/list"]({}));
}

export async function loadAssignments(): Promise<
  Output<"/assignments/for-me">
> {
  return unwrap(await api.assignments["for-me"]({}));
}

export async function loadStaffAssignments(): Promise<
  Output<"/assignments/staff-list">
> {
  return unwrap(await api.assignments["staff-list"]({}));
}

export async function loadAssignmentDetail(
  assignment: string,
): Promise<Output<"/assignments/get">> {
  return unwrap(await api.assignments.get({ assignment }));
}

export async function loadSubmissionLatest(
  assignment: string,
  submitter: string,
): Promise<Output<"/submissions/latest">> {
  return unwrap(await api.submissions.latest({ assignment, submitter }));
}

export async function loadSubmissionAttempts(
  assignment: string,
  submitter: string,
): Promise<Output<"/submissions/attempts">> {
  return unwrap(await api.submissions.attempts({ assignment, submitter }));
}

export async function loadSubmissionsForAssignment(
  assignment: string,
): Promise<Output<"/submissions/for-assignment">> {
  return unwrap(await api.submissions["for-assignment"]({ assignment }));
}

export async function loadSubmissionsForStudent(
  submitter: string,
): Promise<Output<"/submissions/for-student">> {
  return unwrap(await api.submissions["for-student"]({ submitter }));
}

export async function loadGradesForMe(): Promise<Output<"/grades/for-me">> {
  return unwrap(await api.grades["for-me"]({}));
}

export async function loadGradesForStudent(
  learner: string,
): Promise<Output<"/grades/for-student">> {
  return unwrap(await api.grades["for-student"]({ learner }));
}

export async function loadGradesForItem(
  item: string,
): Promise<Output<"/grades/for-item">> {
  return unwrap(await api.grades["for-item"]({ item }));
}

export async function loadGradebook(): Promise<Output<"/grades/gradebook">> {
  return unwrap(await api.grades.gradebook({}));
}

export async function loadLateDayBalance(
  learner: string,
): Promise<Output<"/late-days/balance">> {
  return unwrap(await api["late-days"].balance({ learner }));
}

export async function loadLateDaysList(): Promise<Output<"/late-days/list">> {
  return unwrap(await api["late-days"].list({}));
}

export async function loadLateDaysForAssignment(
  assignment: string,
): Promise<Output<"/late-days/for-assignment">> {
  return unwrap(await api["late-days"]["for-assignment"]({ assignment }));
}

export async function loadVisibleNotes(): Promise<
  Output<"/students/notes/visible">
> {
  return unwrap(await api.students["notes/visible"]({}));
}

export async function loadStaffNotes(
  learner: string,
): Promise<Output<"/students/notes/list">> {
  return unwrap(await api.students["notes/list"]({ learner }));
}

export async function loadStudentDetail(
  user: string,
): Promise<Output<"/students/detail">> {
  return unwrap(await api.students.detail({ user }));
}

export async function loadCalendarMe(
  start: string,
  end: string,
): Promise<Output<"/calendar/me">> {
  return unwrap(await api.calendar.me({ start, end }));
}

export async function loadCalendarStaff(
  start: string,
  end: string,
): Promise<Output<"/calendar/staff">> {
  return unwrap(await api.calendar.staff({ start, end }));
}
