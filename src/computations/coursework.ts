/**
 * Whose work a student's is on one assignment, which attempt and assessment
 * stand for it, when it is due for the student, and how late it was handed in. The
 * staff submissions export, the late days page, and course grades read the
 * same rules from here.
 */

const HOUR = 3_600_000;

/** The artifact an attempt was submitted with; an attempt holds exactly one. */
export function soleArtifact({ artifacts }: { artifacts: string[] }): string {
  return String(artifacts[0]);
}

/**
 * Whose work a student's is on an assignment: their section's when the
 * assignment is submitted by each section and their seat has one, otherwise
 * their own.
 */
export function submitterFor({
  submittedBy,
  section,
  student,
}: {
  submittedBy: string | null;
  section: string | null;
  student: string;
}): string {
  return submittedBy === "SECTION" && section ? section : student;
}

export interface Attempt {
  submission: string;
  number: number;
  submittedAt: string | Date;
  status: string;
}

function time(value: string | Date): number {
  return new Date(value).getTime();
}

function latestByNumber<T extends Attempt>(attempts: readonly T[]): T | undefined {
  return [...attempts]
    .sort(
      (left, right) =>
        left.number - right.number || time(left.submittedAt) - time(right.submittedAt),
    )
    .at(-1);
}

/** The latest submitted attempt; when every attempt is withdrawn, the latest withdrawn one. */
export function selectSubmissionAttempt<T extends Attempt>(attempts: readonly T[]): T | undefined {
  return (
    latestByNumber(attempts.filter((attempt) => attempt.status === "SUBMITTED")) ??
    latestByNumber(attempts)
  );
}

/** The latest submitted attempt. A student with only withdrawn attempts has not handed in. */
export function handedInAttempt<T extends Attempt>(attempts: readonly T[]): T | undefined {
  const attempt = selectSubmissionAttempt(attempts);
  return attempt?.status === "SUBMITTED" ? attempt : undefined;
}

interface AssessmentRecord {
  evidence: string;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date | null;
}

function latestRecord<T extends AssessmentRecord>(records: readonly T[]): T | undefined {
  return [...records]
    .sort(
      (left, right) =>
        time(left.updatedAt ?? left.createdAt) - time(right.updatedAt ?? right.createdAt),
    )
    .at(-1);
}

/**
 * The assessment of the selected attempt, else an assignment-wide excusal.
 * `scope` says which one was found.
 */
export function selectAttemptAssessment<T extends AssessmentRecord>(
  records: readonly T[],
  attempt: Pick<Attempt, "submission"> | undefined,
): { record: T | undefined; scope: "attempt" | "excusal" | null } {
  const attemptRecord = attempt
    ? latestRecord(
        records.filter((record) => String(record.evidence) === String(attempt.submission)),
      )
    : undefined;
  if (attemptRecord) return { record: attemptRecord, scope: "attempt" };
  const excusal = latestRecord(
    records.filter((record) => record.status === "EXCUSED" && record.evidence === ""),
  );
  return { record: excusal, scope: excusal ? "excusal" : null };
}

/** The student's due date before late days: their due override, else the assignment's. */
export function studentDue(dueAt: string | Date, dueOverride: string | Date | null): number {
  return time(dueOverride ?? dueAt);
}

/**
 * The latest due override among a section's current members on an
 * assignment: the section's due date before late days.
 */
export function sectionDueOverride<T extends string | Date>({
  assignment,
  section,
  students,
  releases,
}: {
  assignment: string;
  section: string;
  students: readonly { user: string; section: string | null }[];
  releases: readonly { assignment: string; assignee: string; dueOverride: T | null }[];
}): T | null {
  const members = new Set(
    students.filter((student) => student.section === section).map((student) => student.user),
  );
  let latest: T | null = null;
  for (const release of releases) {
    if (release.assignment !== assignment || !members.has(release.assignee)) continue;
    if (release.dueOverride === null) continue;
    if (latest === null || time(release.dueOverride) > time(latest)) latest = release.dueOverride;
  }
  return latest;
}

/** No late days count on an assignment submitted by each section: there is no one student to charge. */
function countedLateDays(submittedBy: string | null, lateDays: number): number {
  return submittedBy === "SECTION" ? 0 : lateDays;
}

/** The student's due date after late days, in milliseconds; NaN when a date is unreadable. */
export function effectiveDue({
  dueAt,
  dueOverride,
  lateDays,
  unitHours,
  submittedBy,
}: {
  dueAt: string | Date;
  dueOverride: string | Date | null;
  lateDays: number;
  unitHours: number;
  submittedBy: string | null;
}): number {
  return studentDue(dueAt, dueOverride) + countedLateDays(submittedBy, lateDays) * unitHours * HOUR;
}

/**
 * How late an attempt was handed in, against the student's due date before
 * late days, and the late days that cover it.
 */
export function lateness({
  submittedAt,
  dueAt,
  dueOverride,
  unitHours,
}: {
  submittedAt: string | Date;
  dueAt: string | Date;
  dueOverride: string | Date | null;
  unitHours: number;
}): { lateMs: number; daysNeeded: number } {
  const lateMs = Math.max(0, time(submittedAt) - studentDue(dueAt, dueOverride));
  return { lateMs, daysNeeded: lateMs === 0 ? 0 : Math.ceil(lateMs / (unitHours * HOUR)) };
}

/** Whether an attempt counts as late once the student's late days are added. */
export function handedInLate({
  submittedAt,
  dueAt,
  dueOverride,
  lateDays,
  unitHours,
  submittedBy,
}: {
  submittedAt: string | Date;
  dueAt: string | Date;
  dueOverride: string | Date | null;
  lateDays: number;
  unitHours: number;
  submittedBy: string | null;
}): boolean {
  return time(submittedAt) > effectiveDue({ dueAt, dueOverride, lateDays, unitHours, submittedBy });
}

/** Whether nothing is handed in and the student's due date, with late days, has passed. */
export function overdue({
  handedIn,
  dueAt,
  dueOverride,
  lateDays,
  unitHours,
  submittedBy,
  at,
}: {
  handedIn: boolean;
  dueAt: string | Date;
  dueOverride: string | Date | null;
  lateDays: number;
  unitHours: number;
  submittedBy: string | null;
  at: Date;
}): boolean {
  return (
    !handedIn &&
    at.getTime() > effectiveDue({ dueAt, dueOverride, lateDays, unitHours, submittedBy })
  );
}

/**
 * The most late days one assignment can hold: the per-assignment limit, or the
 * remaining balance plus the days already on it, whichever is smaller.
 */
export function lateDayCap({
  perItemLimit,
  remaining,
  applied,
}: {
  perItemLimit: number;
  remaining: number;
  applied: number;
}): number {
  return Math.max(0, Math.min(perItemLimit, remaining + applied));
}
