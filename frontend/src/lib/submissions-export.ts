import type { Output } from "@/lib/api";
import { downloadCsv, fileSlug, toCsv } from "@/lib/csv";

type Row<T> = T extends readonly (infer Element)[] ? Element : never;

export type AssignedLearner = Row<
  Output<"/submissions/for-assignment">["assigned"]
>;
export type LearnerAttempt = Row<
  Output<"/submissions/for-assignment">["submissions"]
>;
export type ItemAssessment = Row<Output<"/grades/for-item">["grades"]>;
export type ItemGrading = Output<"/grades/item">;
export type DelegationRow = Row<Output<"/delegation/for-item">["delegations"]>;
export type AvailableGrader = Row<Output<"/delegation/graders">["graders"]>;

export interface SubmissionsExportSource {
  assignment: string;
  title: string;
  dueAt: string;
  /** Only the freshly selected scope, including learners without submissions. */
  assigned: readonly AssignedLearner[];
  submissions: readonly LearnerAttempt[];
  grades: readonly ItemAssessment[];
  grading: Pick<ItemGrading, "method" | "revision" | "maxPoints">;
  delegations: readonly DelegationRow[];
  graders: readonly AvailableGrader[];
  sectionNames: ReadonlyMap<string, string>;
  /** Null means this caller could not read student-record information. */
  lateDays: ReadonlyMap<string, number> | null;
  lateDayUnitHours: number | null;
  origin: string;
}

export const SUBMISSIONS_CSV_COLUMNS = [
  "Student name",
  "Username",
  "Email",
  "Student ID",
  "Section ID",
  "Section name",
  "Assignment title",
  "Assignment ID",
  "Course due at",
  "Due override",
  "Late days applied",
  "Effective due at",
  "Submission status",
  "Submission ID",
  "Attempt number",
  "Submitted at",
  "Late status",
  "Assigned grader",
  "Grader username",
  "Grader ID",
  "Grader availability",
  "Grading method",
  "Grade scope",
  "Grade status",
  "Grade ID",
  "Grade updated at",
  "Score",
  "Maximum points",
  "Attempt link",
] as const;

function iso(value: string | null | undefined): string {
  if (!value) return "";
  const moment = new Date(value);
  return Number.isNaN(moment.getTime()) ? "" : moment.toISOString();
}

function latestByNumber(attempts: readonly LearnerAttempt[]) {
  return [...attempts]
    .sort(
      (left, right) =>
        left.number - right.number ||
        new Date(left.submittedAt).getTime() -
          new Date(right.submittedAt).getTime(),
    )
    .at(-1);
}

function latestGradeRecord<T extends { createdAt: string; updatedAt: string }>(
  records: readonly T[],
) {
  return [...records]
    .sort(
      (left, right) =>
        new Date(left.updatedAt ?? left.createdAt).getTime() -
        new Date(right.updatedAt ?? right.createdAt).getTime(),
    )
    .at(-1);
}

function exportedGrade<
  T extends { evidence: string; status: string } & {
    createdAt: string;
    updatedAt: string;
  },
>(
  records: readonly T[],
  attempt: LearnerAttempt | undefined,
) {
  const assignmentExcusal = latestGradeRecord(
    records.filter(
      (record) => record.status === "EXCUSED" && record.evidence === "",
    ),
  );
  const attemptRecord = attempt
    ? latestGradeRecord(
        records.filter(
          (record) => String(record.evidence) === String(attempt.submission),
        ),
      )
    : undefined;
  return {
    record: attemptRecord ?? assignmentExcusal,
    scope: attemptRecord
      ? `Attempt ${attempt?.number}`
      : assignmentExcusal
        ? "Assignment excusal"
        : "",
  };
}

function effectiveDue(
  dueAt: string,
  override: string | null,
  lateDays: number | null,
  unitHours: number | null,
): string {
  if (lateDays === null || unitHours === null) return "";
  const base = new Date(override ?? dueAt);
  if (Number.isNaN(base.getTime())) return "";
  return new Date(
    base.getTime() + lateDays * unitHours * 3_600_000,
  ).toISOString();
}

/**
 * Build one row per learner. Submission columns use the latest active
 * (SUBMITTED) attempt; when every attempt is withdrawn, the latest withdrawn
 * record remains linked so that the withdrawal is inspectable.
 */
export function submissionsCsv(source: SubmissionsExportSource): {
  filename: string;
  csv: string;
} {
  const delegationByLearner = new Map(
    source.delegations.map((row) => [String(row.learner), row]),
  );
  const availableById = new Map(
    source.graders.map((grader) => [String(grader.grader), grader]),
  );

  const rows = source.assigned.map((learner) => {
    const learnerId = String(learner.assignee);
    const attempts = source.submissions.filter(
      (attempt) => String(attempt.submitter) === learnerId,
    );
    const active = latestByNumber(
      attempts.filter((attempt) => attempt.status === "SUBMITTED"),
    );
    const recorded = latestByNumber(attempts);
    const attempt = active ?? recorded;
    const submissionStatus = active
      ? "Submitted"
      : recorded
        ? "Withdrawn"
        : "Missing";
    const selected = exportedGrade(
      source.grades.filter((grade) => String(grade.learner) === learnerId),
      attempt,
    );
    const grade = selected.record;
    const isPoints = (grade?.method ?? source.grading.method) === "POINTS";
    const score =
      grade?.method === "POINTS" && grade.scored && grade.status !== "EXCUSED"
        ? grade.score
        : "";
    const maximum = isPoints
      ? (grade?.outOf ?? source.grading.maxPoints)
      : "";
    const delegation = delegationByLearner.get(learnerId);
    const grader = delegation
      ? availableById.get(String(delegation.grader))
      : undefined;
    const graderName = delegation
      ? (grader?.displayName ??
        delegation.graderName ??
        grader?.username ??
        delegation.graderUsername ??
        String(delegation.grader))
      : "";
    const days = source.lateDays?.get(learnerId) ?? 0;
    const effective = effectiveDue(
      source.dueAt,
      learner.dueOverride,
      source.lateDays === null ? null : days,
      source.lateDayUnitHours,
    );
    const lateStatus = active
      ? effective === ""
        ? "Unavailable"
        : new Date(active.submittedAt).getTime() > new Date(effective).getTime()
          ? "Late"
          : "On time"
      : "";
    const attemptLink = attempt
      ? `${source.origin}/staff/assignments/${encodeURIComponent(source.assignment)}#attempt-${encodeURIComponent(String(attempt.submission))}`
      : `${source.origin}/staff/assignments/${encodeURIComponent(source.assignment)}`;

    return [
      learner.displayName ?? learnerId,
      learner.username ?? "",
      learner.email ?? "",
      learnerId,
      learner.section ?? "",
      learner.section === null
        ? ""
        : (source.sectionNames.get(String(learner.section)) ?? ""),
      source.title,
      source.assignment,
      iso(source.dueAt),
      iso(learner.dueOverride),
      source.lateDays === null ? "" : days,
      effective,
      submissionStatus,
      attempt ? String(attempt.submission) : "",
      attempt?.number ?? "",
      iso(attempt?.submittedAt),
      lateStatus,
      graderName,
      delegation ? (grader?.username ?? delegation.graderUsername ?? "") : "",
      delegation ? String(delegation.grader) : "",
      delegation ? (grader ? "Available" : "Unavailable") : "",
      isPoints ? "Points" : "Competency",
      selected.scope,
      grade?.status ?? "",
      grade ? String(grade.grade) : "",
      iso(grade?.updatedAt),
      score,
      maximum,
      attemptLink,
    ];
  });

  return {
    filename: `${fileSlug(source.title, "assignment")}-submissions.csv`,
    csv: toCsv([[...SUBMISSIONS_CSV_COLUMNS], ...rows]),
  };
}

export function downloadSubmissionsCsv(source: SubmissionsExportSource): void {
  const { filename, csv } = submissionsCsv(source);
  downloadCsv(filename, csv);
}
