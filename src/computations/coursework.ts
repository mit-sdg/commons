/**
 * Which attempt and assessment stand for a student's work on one assignment,
 * when that work is due for the student, and how late it was handed in. The
 * staff submissions export, the late days page, and course grades read the
 * same rules from here.
 */

const HOUR = 3_600_000;

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

/** The student's due date after late days, in milliseconds; NaN when a date is unreadable. */
export function effectiveDue({
  dueAt,
  dueOverride,
  lateDays,
  unitHours,
}: {
  dueAt: string | Date;
  dueOverride: string | Date | null;
  lateDays: number;
  unitHours: number;
}): number {
  return studentDue(dueAt, dueOverride) + lateDays * unitHours * HOUR;
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
}: {
  submittedAt: string | Date;
  dueAt: string | Date;
  dueOverride: string | Date | null;
  lateDays: number;
  unitHours: number;
}): boolean {
  return time(submittedAt) > effectiveDue({ dueAt, dueOverride, lateDays, unitHours });
}

/** Whether nothing is handed in and the student's due date, with late days, has passed. */
export function overdue({
  handedIn,
  dueAt,
  dueOverride,
  lateDays,
  unitHours,
  at,
}: {
  handedIn: boolean;
  dueAt: string | Date;
  dueOverride: string | Date | null;
  lateDays: number;
  unitHours: number;
  at: Date;
}): boolean {
  return !handedIn && at.getTime() > effectiveDue({ dueAt, dueOverride, lateDays, unitHours });
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
