/**
 * The course-grade calculation: how a policy turns released competency
 * ratings into each student's average, letter, and breakdown. The Course
 * grades page, the release, and the download run this same code, the page in
 * the browser and the rest on the server, over the same inputs.
 */
import {
  type Attempt,
  effectiveDue,
  handedInAttempt,
  handedInLate,
  selectAttemptAssessment,
} from "./coursework.ts";
import { lectureAttendance } from "./lectures.ts";

/* ---------- The policy ---------- */

export const RATING_NAMES = ["DEFICIENT", "EMERGENT", "COMPETENT", "EXPERT"] as const;
export type RatingName = (typeof RATING_NAMES)[number];

export type Combine = "average" | "best" | "dropLowest";
export type SkillCount = "latest" | "best" | "average";
export type SkillFrom = "personal" | "all";
export type GradeSet = "letters" | "plusMinus";

export type PolicyRow =
  | { key: string; type: "assignment"; assignment: string; weight: number }
  | {
      key: string;
      type: "skill";
      standard: string;
      weight: number;
      count: SkillCount;
      from: SkillFrom;
    };

export interface PolicyGroup {
  key: string;
  name: string;
  weight: number;
  combine: Combine;
  rows: PolicyRow[];
}

export interface GradeLine {
  grade: string;
  at: number;
}

export interface AttendanceRule {
  key: string;
  /** Fewer than this percent of lectures… */
  below: number;
  /** …caps the letter at this grade. */
  atMost: string;
}

/** A policy's specification, the value Policymaking saves. */
export interface CoursePolicy {
  ratings: Record<RatingName, number>;
  missing: number;
  late: "missing" | "graded";
  /** Per assignment, the weight of each skill by standard; a skill not listed weighs 1. */
  skillWeights: Record<string, Record<string, number>>;
  groups: PolicyGroup[];
  attendance: AttendanceRule[];
  gradeSet: GradeSet;
  lines: Record<GradeSet, GradeLine[]>;
}

/** The assignment kind whose work is team work. */
export const TEAM_KIND = "FINAL_PROJECT";

/* ---------- The inputs ---------- */

export interface AssignmentInput {
  assignment: string;
  title: string;
  kind: string;
  dueAt: string | Date;
  acceptsSubmissions: boolean;
}
export interface ReleaseInput {
  assignment: string;
  assignee: string;
  dueOverride: string | Date | null;
}
export interface AttemptInput extends Attempt {
  assignment: string;
  submitter: string;
}
export interface CriterionInput {
  criterion: string;
  kind: string;
  standard: string;
  name: string;
  maxPoints: number;
}
export interface JudgmentInput {
  criterion: string;
  rating: string | null;
  score: number | null;
}
export interface AssessmentInput {
  learner: string;
  item: string;
  evidence: string;
  status: string;
  method: string;
  createdAt: string | Date;
  updatedAt: string | Date | null;
  criteria: CriterionInput[];
  /** Present only for released assessments. */
  judgments: JudgmentInput[];
}
export interface UseInput {
  learner: string;
  item: string;
  days: number;
}
export interface OverrideInput {
  subject: string;
  value: string;
  reason: string;
  replaced: string;
  author: string;
  setAt: string | Date;
}

export interface StudentInput {
  user: string;
  section: string | null;
  email: string;
  name: string;
}
export interface LectureRunInput {
  run: string;
  openedAt: string | Date;
  /** Everyone who joined the run or one of its rounds. */
  joined: string[];
}

export interface CourseGradeInputs {
  assignments: AssignmentInput[];
  releases: ReleaseInput[];
  attempts: AttemptInput[];
  assessments: AssessmentInput[];
  uses: UseInput[];
  unitHours: number;
  students: StudentInput[];
  lectureRuns: LectureRunInput[];
  timezone: string | null;
  overrides: OverrideInput[];
}

/* ---------- The results ---------- */

/**
 * Where one assignment stands for one student. Statuses that are left out
 * scale the remaining weights up; `missing` and `late` count as the Missing
 * value (`late` only under the "counts as missing" rule).
 */
export type WorkStatus =
  | "rated"
  | "lateRated"
  | "missing"
  | "late"
  | "notDue"
  | "notAssigned"
  | "excused"
  | "draft"
  | "ungraded"
  | "notAssessed";

const COUNTED = new Set<WorkStatus>(["rated", "lateRated", "missing", "late"]);

export interface WorkResult {
  assignment: string;
  status: WorkStatus;
  /** On the rating scale; null when left out. */
  value: number | null;
  /** Ratings by standard from a released assessment. */
  skills: Record<string, RatingName>;
  points: { score: number; outOf: number } | null;
}

export interface RowResult {
  key: string;
  value: number | null;
  /** For a skill row, the assignments whose ratings counted. */
  counted: string[];
  dropped: boolean;
}

export interface GroupResult {
  key: string;
  name: string;
  weight: number;
  value: number | null;
  rows: RowResult[];
}

export interface StudentGrade {
  student: string;
  work: Record<string, WorkResult>;
  groups: GroupResult[];
  /** Rounded to two decimals once; graded from this value. */
  average: number | null;
  /** The letter from the lines alone. */
  lineGrade: string | null;
  /** The letter after the attendance rule. */
  policyGrade: string | null;
  /** The letter after any override. */
  grade: string | null;
  cappedBy: AttendanceRule | null;
  override: OverrideInput | null;
  lectures: { attended: number; total: number };
}

/* ---------- The calculation ---------- */

const round2 = (value: number) => Math.round(value * 100 + Number.EPSILON) / 100;
const time = (value: string | Date) => new Date(value).getTime();

function ratingRange(policy: CoursePolicy) {
  const values = RATING_NAMES.map((name) => policy.ratings[name]);
  return { low: Math.min(...values), high: Math.max(...values) };
}

/** The assignments that can count, in course due order: those that accept submissions. */
export function countedAssignments(
  inputs: Pick<CourseGradeInputs, "assignments">,
): AssignmentInput[] {
  return inputs.assignments
    .filter((assignment) => assignment.acceptsSubmissions)
    .sort((left, right) => time(left.dueAt) - time(right.dueAt));
}

function workFor(
  policy: CoursePolicy,
  inputs: CourseGradeInputs,
  index: Indexes,
  student: string,
  assignment: AssignmentInput,
  dueBy: Date,
  at: Date,
): WorkResult {
  const result = (
    status: WorkStatus,
    value: number | null = null,
    skills: Record<string, RatingName> = {},
    points: WorkResult["points"] = null,
  ): WorkResult => ({ assignment: assignment.assignment, status, value, skills, points });
  const release = index.releases.get(`${assignment.assignment}:${student}`);
  if (!release) return result("notAssigned");
  if (time(assignment.dueAt) > dueBy.getTime()) return result("notDue");
  const attempts = index.attempts.get(`${assignment.assignment}:${student}`) ?? [];
  const handedIn = handedInAttempt(attempts);
  const records = index.assessments.get(`${assignment.assignment}:${student}`) ?? [];
  const { record } = selectAttemptAssessment(records, handedIn);
  if (record?.status === "EXCUSED") return result("excused");
  const lateDays = index.uses.get(`${assignment.assignment}:${student}`) ?? 0;
  const due = {
    dueAt: assignment.dueAt,
    dueOverride: release.dueOverride,
    lateDays,
    unitHours: inputs.unitHours,
  };
  if (!handedIn) {
    return effectiveDue(due) < at.getTime() ? result("missing", policy.missing) : result("notDue");
  }
  if (!record) return result("ungraded");
  if (record.status !== "RELEASED") return result("draft");
  const late = handedInLate({ submittedAt: handedIn.submittedAt, ...due });
  if (late && policy.late === "missing") return result("late", policy.missing);
  const status: WorkStatus = late ? "lateRated" : "rated";
  if (record.method === "POINTS") {
    const outOf = record.criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0);
    const score = record.judgments.reduce((sum, judgment) => sum + (judgment.score ?? 0), 0);
    if (outOf <= 0) return result("notAssessed");
    const { low, high } = ratingRange(policy);
    return result(status, low + (score / outOf) * (high - low), {}, { score, outOf });
  }
  const standardOf = new Map(
    record.criteria.map((criterion) => [criterion.criterion, criterion.standard]),
  );
  const weights = policy.skillWeights[assignment.assignment] ?? {};
  const skills: Record<string, RatingName> = {};
  let sum = 0;
  let weight = 0;
  for (const judgment of record.judgments) {
    const rating = judgment.rating as RatingName | null;
    if (rating === null || !RATING_NAMES.includes(rating)) continue;
    const standard = standardOf.get(judgment.criterion) ?? "";
    skills[standard] = rating;
    const w = weights[standard] ?? 1;
    sum += w * policy.ratings[rating];
    weight += w;
  }
  return weight > 0 ? result(status, sum / weight, skills) : result("notAssessed");
}

interface Lectures {
  total: number;
  attended: Map<string, Set<string>>;
}

/** The lectures held by the cutoff, and the dates each student was present. */
function lecturesBy(inputs: CourseGradeInputs, dueBy: Date): Lectures {
  const { lectures, attended } = lectureAttendance({
    runs: inputs.lectureRuns
      .filter((run) => time(run.openedAt) <= dueBy.getTime())
      .map((run) => ({ ...run, title: "", kind: "", signedOut: [] })),
    students: inputs.students.map((student) => student.user),
    timezone: inputs.timezone,
  });
  return { total: lectures.length, attended };
}

interface Indexes {
  releases: Map<string, ReleaseInput>;
  attempts: Map<string, AttemptInput[]>;
  assessments: Map<string, AssessmentInput[]>;
  uses: Map<string, number>;
  overrides: Map<string, OverrideInput>;
}

function indexes(inputs: CourseGradeInputs): Indexes {
  const group = <T>(rows: readonly T[], key: (row: T) => string) => {
    const map = new Map<string, T[]>();
    for (const row of rows) map.set(key(row), [...(map.get(key(row)) ?? []), row]);
    return map;
  };
  return {
    releases: new Map(inputs.releases.map((row) => [`${row.assignment}:${row.assignee}`, row])),
    attempts: group(inputs.attempts, (row) => `${row.assignment}:${row.submitter}`),
    assessments: group(inputs.assessments, (row) => `${row.item}:${row.learner}`),
    uses: new Map(inputs.uses.map((row) => [`${row.item}:${row.learner}`, row.days])),
    overrides: new Map(inputs.overrides.map((row) => [row.subject, row])),
  };
}

function skillRow(
  policy: CoursePolicy,
  row: Extract<PolicyRow, { type: "skill" }>,
  assignments: AssignmentInput[],
  work: Record<string, WorkResult>,
): RowResult {
  const rated = assignments
    .filter((assignment) => row.from === "all" || assignment.kind !== TEAM_KIND)
    .flatMap((assignment) => {
      const result = work[assignment.assignment];
      const rating = result && COUNTED.has(result.status) ? result.skills[row.standard] : undefined;
      return rating ? [{ assignment: assignment.assignment, value: policy.ratings[rating] }] : [];
    });
  if (rated.length === 0) return { key: row.key, value: null, counted: [], dropped: false };
  if (row.count === "latest") {
    const last = rated.at(-1)!;
    return { key: row.key, value: last.value, counted: [last.assignment], dropped: false };
  }
  if (row.count === "best") {
    const best = rated.reduce((top, entry) => (entry.value >= top.value ? entry : top));
    return { key: row.key, value: best.value, counted: [best.assignment], dropped: false };
  }
  return {
    key: row.key,
    value: rated.reduce((sum, entry) => sum + entry.value, 0) / rated.length,
    counted: rated.map((entry) => entry.assignment),
    dropped: false,
  };
}

function weightedAverage(entries: { value: number; weight: number }[]): number | null {
  const weight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  return weight > 0
    ? entries.reduce((sum, entry) => sum + entry.weight * entry.value, 0) / weight
    : null;
}

function groupResult(
  policy: CoursePolicy,
  group: PolicyGroup,
  assignments: AssignmentInput[],
  work: Record<string, WorkResult>,
): GroupResult {
  const rows = group.rows.map((row) =>
    row.type === "assignment"
      ? {
          key: row.key,
          value: work[row.assignment]?.value ?? null,
          counted: [] as string[],
          dropped: false,
        }
      : skillRow(policy, row, assignments, work),
  );
  const weightOf = new Map(group.rows.map((row) => [row.key, row.weight]));
  let live = rows.filter(
    (row) => row.value !== null && (group.combine === "best" || (weightOf.get(row.key) ?? 0) > 0),
  );
  if (group.combine === "dropLowest" && live.length > 1) {
    const lowest = live.reduce((low, row) => (row.value! < low.value! ? row : low));
    lowest.dropped = true;
    live = live.filter((row) => row !== lowest);
  }
  const value =
    live.length === 0
      ? null
      : group.combine === "best"
        ? Math.max(...live.map((row) => row.value!))
        : weightedAverage(
            live.map((row) => ({ value: row.value!, weight: weightOf.get(row.key) ?? 0 })),
          );
  return {
    key: group.key,
    name: group.name,
    weight: group.weight,
    value: value === null ? null : round2(value),
    rows,
  };
}

/** The policy's letters, best first, ending with F. */
export function gradeOrder(policy: CoursePolicy): string[] {
  return [
    ...[...policy.lines[policy.gradeSet]]
      .sort((left, right) => right.at - left.at)
      .map((line) => line.grade),
    "F",
  ];
}

/** A letter's place in the policy's order; a letter from the other grade set matches by its first letter. */
export function gradeRank(policy: CoursePolicy, grade: string): number {
  const order = gradeOrder(policy);
  const exact = order.indexOf(grade);
  if (exact >= 0) return exact;
  const first = order.findIndex((entry) => entry[0] === grade[0]);
  return first >= 0 ? first : order.length - 1;
}

/** The letter for an average under the policy's lines. */
export function lineGrade(policy: CoursePolicy, average: number): string {
  const lines = [...policy.lines[policy.gradeSet]].sort((left, right) => right.at - left.at);
  return lines.find((line) => average >= line.at)?.grade ?? "F";
}

/** Whether a letter is below C in the policy's grade set. */
export function belowC(policy: CoursePolicy, grade: string): boolean {
  return gradeRank(policy, grade) > gradeRank(policy, "C");
}

/** One student's grade: work, groups, average, the lines, then attendance, then any override. */
export function studentGrade(
  policy: CoursePolicy,
  inputs: CourseGradeInputs,
  student: string,
  dueBy: Date,
  at: Date,
  index: Indexes = indexes(inputs),
  lectures: Lectures = lecturesBy(inputs, dueBy),
): StudentGrade {
  const assignments = countedAssignments(inputs);
  const work = Object.fromEntries(
    assignments.map((assignment) => [
      assignment.assignment,
      workFor(policy, inputs, index, student, assignment, dueBy, at),
    ]),
  );
  const groups = policy.groups.map((group) => groupResult(policy, group, assignments, work));
  const total = weightedAverage(
    groups
      .filter((group) => group.value !== null && group.weight > 0)
      .map((group) => ({ value: group.value!, weight: group.weight })),
  );
  const average = total === null ? null : round2(total);
  const attended = lectures.attended.get(student)?.size ?? 0;
  const fromLines = average === null ? null : lineGrade(policy, average);
  let cappedBy: AttendanceRule | null = null;
  let policyGrade = fromLines;
  if (policyGrade !== null && lectures.total > 0) {
    const percent = (attended / lectures.total) * 100;
    for (const rule of policy.attendance) {
      if (percent < rule.below && gradeRank(policy, rule.atMost) > gradeRank(policy, policyGrade)) {
        cappedBy = rule;
        policyGrade = rule.atMost;
      }
    }
  }
  const override = index.overrides.get(student) ?? null;
  return {
    student,
    work,
    groups,
    average,
    lineGrade: fromLines,
    policyGrade,
    grade: override?.value ?? policyGrade,
    cappedBy,
    override,
    lectures: { attended, total: lectures.total },
  };
}

/** Every student's grade under one policy. */
export function courseGrades(
  policy: CoursePolicy,
  inputs: CourseGradeInputs,
  dueBy: Date,
  at: Date,
): StudentGrade[] {
  const index = indexes(inputs);
  const lectures = lecturesBy(inputs, dueBy);
  return inputs.students.map((student) =>
    studentGrade(policy, inputs, student.user, dueBy, at, index, lectures),
  );
}

/** Why a student is held at a release: below C, or drafts and ungraded work in what counts. */
export function holdReasons(policy: CoursePolicy, grade: StudentGrade): string[] {
  const reasons: string[] = [];
  if (grade.grade !== null && belowC(policy, grade.grade)) reasons.push("below C");
  if (Object.values(grade.work).some((work) => work.status === "draft")) reasons.push("draft");
  if (Object.values(grade.work).some((work) => work.status === "ungraded"))
    reasons.push("ungraded");
  return reasons;
}

/* ---------- Building the inputs from the class-wide reads ---------- */

/**
 * The calculation's inputs from the class-wide reads. A lecture run's
 * participants are those who responded to it or to one of its rounds.
 */
export function courseGradeInputs({
  assignments,
  releases,
  attempts,
  ratings,
  uses,
  unitHours,
  students,
  names,
  lectures,
  editions,
  parts,
  participation,
  detail,
  overrides,
}: {
  assignments: AssignmentInput[];
  releases: ReleaseInput[];
  attempts: AttemptInput[];
  ratings: AssessmentInput[];
  uses: UseInput[];
  unitHours: number;
  students: { user: string; section: string | null; email: string }[];
  names: { user: string; displayName: string }[];
  lectures: string[];
  editions: { edition: string; whole: string | null; openedAt: string | Date }[];
  parts: { whole: string; edition: string }[];
  participation: { subject: string; participant: string }[];
  detail: { timezone: string } | null;
  overrides: OverrideInput[];
}): CourseGradeInputs {
  const nameOf = new Map(names.map((entry) => [entry.user, entry.displayName]));
  const runOf = new Map<string, string>();
  for (const run of lectures) runOf.set(run, run);
  for (const part of parts) runOf.set(part.edition, part.whole);
  const joined = new Map<string, Set<string>>();
  for (const { subject, participant } of participation) {
    const run = runOf.get(subject);
    if (run === undefined) continue;
    joined.set(run, (joined.get(run) ?? new Set()).add(participant));
  }
  return {
    assignments,
    releases,
    attempts,
    assessments: ratings,
    uses,
    unitHours,
    students: students.map((student) => ({
      ...student,
      name: nameOf.get(student.user) || student.email,
    })),
    lectureRuns: editions
      .filter((edition) => edition.whole === null && lectures.includes(edition.edition))
      .map((edition) => ({
        run: edition.edition,
        openedAt: edition.openedAt,
        joined: [...(joined.get(edition.edition) ?? [])],
      })),
    timezone: detail?.timezone ?? null,
    overrides,
  };
}

/** The lists the calculation's lecture runs are read through: the runs and their rounds. */
export function lectureSubjectList({
  lectures,
  parts,
}: {
  lectures: string[];
  parts: { edition: string }[];
}): string[] {
  return [...lectures, ...parts.map((part) => part.edition)];
}

/* ---------- What a student sees ---------- */

/** One row of a student's breakdown. */
export interface CardRow {
  title: string;
  value: number | null;
  /** "9/10" for a points assignment. */
  points: string | null;
  /** Why a row is left out or counts as Missing. */
  note: string | null;
}

export interface CardGroup {
  name: string;
  weight: number;
  value: number | null;
  rows: CardRow[];
}

/** A student's released course grade: only what the student may see. */
export interface CourseGradeCard {
  status: "released" | "held";
  dueBy: string;
  average: number | null;
  scale: { low: number; high: number };
  letter: string | null;
  groups: CardGroup[] | null;
  lectures: { attended: number; total: number } | null;
  rules: { ratings: Record<RatingName, number>; missing: number; late: CoursePolicy["late"] };
}

export interface ReleaseSettings {
  dueBy: string;
  breakdown: boolean;
  letter: boolean;
  includeOverrides: boolean;
}

const NOTES: Partial<Record<WorkStatus, string>> = {
  late: "late, no late days",
  missing: "missing",
  excused: "excused, left out",
  draft: "not released yet, left out",
  ungraded: "not released yet, left out",
  notDue: "not due yet",
  notAssessed: "not assessed, left out",
};

function assignmentTitle(inputs: CourseGradeInputs, assignment: string): string {
  return inputs.assignments.find((entry) => entry.assignment === assignment)?.title ?? "";
}

function skillName(inputs: CourseGradeInputs, standard: string): string {
  for (const assessment of inputs.assessments)
    for (const criterion of assessment.criteria)
      if (criterion.standard === standard && criterion.name) return criterion.name;
  return standard;
}

/** The card a student sees for one grade under the release settings. */
export function courseGradeCard(
  policy: CoursePolicy,
  inputs: CourseGradeInputs,
  grade: StudentGrade,
  settings: ReleaseSettings,
  held: boolean,
): CourseGradeCard {
  const { low, high } = ratingRange(policy);
  const rules = { ratings: policy.ratings, missing: policy.missing, late: policy.late };
  if (held)
    return {
      status: "held",
      dueBy: settings.dueBy,
      average: null,
      scale: { low, high },
      letter: null,
      groups: null,
      lectures: null,
      rules,
    };
  const rowOf = new Map(policy.groups.flatMap((group) => group.rows.map((row) => [row.key, row])));
  const groups = settings.breakdown
    ? grade.groups.map((group) => ({
        name: group.name,
        weight: group.weight,
        value: group.value,
        rows: group.rows.map((row): CardRow => {
          const authored = rowOf.get(row.key)!;
          if (authored.type === "skill")
            return {
              title: skillName(inputs, authored.standard),
              value: row.value === null ? null : round2(row.value),
              points: null,
              note: null,
            };
          const work = grade.work[authored.assignment];
          const note = work ? (NOTES[work.status] ?? null) : null;
          return {
            title: assignmentTitle(inputs, authored.assignment),
            value: work && COUNTED.has(work.status) ? round2(work.value!) : null,
            points: work?.points ? `${work.points.score}/${work.points.outOf}` : null,
            note:
              note && (work!.status === "late" || work!.status === "missing")
                ? `${note}: ${policy.missing}`
                : note,
          };
        }),
      }))
    : null;
  return {
    status: "released",
    dueBy: settings.dueBy,
    average: grade.average,
    scale: { low, high },
    letter: settings.letter ? (settings.includeOverrides ? grade.grade : grade.policyGrade) : null,
    groups,
    lectures: policy.attendance.length > 0 ? grade.lectures : null,
    rules,
  };
}

/* ---------- Releases ---------- */

export interface ReleasedPolicy {
  policy: string;
  name: string;
  version: number;
  specification: CoursePolicy;
}

/** What a release keeps once for the class: the assignments and the lecture dates. */
export interface ReleasedCourse {
  assignments: AssignmentInput[];
  unitHours: number;
  lectureRuns: { run: string; openedAt: string | Date }[];
  timezone: string | null;
}

/** One student's rows of the inputs, and the lecture runs they joined. */
export interface StudentRecord {
  student: StudentInput;
  releases: ReleaseInput[];
  attempts: AttemptInput[];
  assessments: AssessmentInput[];
  uses: UseInput[];
  lectures: string[];
  override: OverrideInput | null;
}

/** What a release keeps for one student: their card, why they were held, and their inputs. */
export interface StudentCopy {
  card: CourseGradeCard;
  held: string[] | null;
  record: StudentRecord;
}

/** What one class release keeps: its policy, settings, the course once, and a copy per student. */
export interface CourseGradeRelease {
  kind: "release";
  policy: ReleasedPolicy;
  settings: ReleaseSettings;
  course: ReleasedCourse;
  releasedBy: string;
  releasedAt: string;
  students: Record<string, StudentCopy>;
}

/** What an update of one student's course grade keeps: the same, for that student alone. */
export interface CourseGradeUpdate {
  kind: "update";
  policy: ReleasedPolicy;
  settings: ReleaseSettings;
  course: ReleasedCourse;
  student: string;
  reason: string;
  releasedBy: string;
  releasedAt: string;
  copy: StudentCopy;
}

function releasedCourse(inputs: CourseGradeInputs): ReleasedCourse {
  return {
    assignments: inputs.assignments,
    unitHours: inputs.unitHours,
    lectureRuns: inputs.lectureRuns.map(({ run, openedAt }) => ({ run, openedAt })),
    timezone: inputs.timezone,
  };
}

function studentRecord(inputs: CourseGradeInputs, student: string): StudentRecord {
  return {
    student: inputs.students.find((entry) => entry.user === student) ?? {
      user: student,
      section: null,
      email: "",
      name: "",
    },
    releases: inputs.releases.filter((entry) => entry.assignee === student),
    attempts: inputs.attempts.filter((entry) => entry.submitter === student),
    assessments: inputs.assessments.filter((entry) => entry.learner === student),
    uses: inputs.uses.filter((entry) => entry.learner === student),
    lectures: inputs.lectureRuns
      .filter((run) => run.joined.includes(student))
      .map((run) => run.run),
    override: inputs.overrides.find((entry) => entry.subject === student) ?? null,
  };
}

/** The inputs one student's copy was computed from, rebuilt from what the release keeps. */
export function copyInputs(course: ReleasedCourse, record: StudentRecord): CourseGradeInputs {
  const user = record.student.user;
  return {
    assignments: course.assignments,
    releases: record.releases,
    attempts: record.attempts,
    assessments: record.assessments,
    uses: record.uses,
    unitHours: course.unitHours,
    students: [record.student],
    lectureRuns: course.lectureRuns.map((run) => ({
      ...run,
      joined: record.lectures.includes(run.run) ? [user] : [],
    })),
    timezone: course.timezone,
    overrides: record.override === null ? [] : [record.override],
  };
}

/**
 * A release to the class under the final policy. Students the review holds
 * get the held card unless staff released them by name.
 */
export function releaseValue({
  policy,
  inputs,
  settings,
  release,
  by,
  at,
}: {
  policy: ReleasedPolicy;
  inputs: CourseGradeInputs;
  settings: ReleaseSettings;
  release: string[];
  by: string;
  at: Date;
}): CourseGradeRelease {
  const spec = policy.specification;
  const grades = courseGrades(spec, inputs, new Date(settings.dueBy), at);
  const students: Record<string, StudentCopy> = {};
  for (const grade of grades) {
    const reasons = holdReasons(spec, grade);
    const holding = reasons.length > 0 && !release.includes(grade.student);
    students[grade.student] = {
      card: courseGradeCard(spec, inputs, grade, settings, holding),
      held: holding ? reasons : null,
      record: studentRecord(inputs, grade.student),
    };
  }
  return {
    kind: "release",
    policy,
    settings,
    course: releasedCourse(inputs),
    releasedBy: by,
    releasedAt: at.toISOString(),
    students,
  };
}

/** One student's card re-released under the class release's policy and settings. */
export function updateValue({
  release,
  inputs,
  student,
  reason,
  by,
  at,
}: {
  release: CourseGradeRelease;
  inputs: CourseGradeInputs;
  student: string;
  reason: string;
  by: string;
  at: Date;
}): CourseGradeUpdate {
  const spec = release.policy.specification;
  const grade = studentGrade(spec, inputs, student, new Date(release.settings.dueBy), at);
  return {
    kind: "update",
    policy: release.policy,
    settings: release.settings,
    course: releasedCourse(inputs),
    student,
    reason,
    releasedBy: by,
    releasedAt: at.toISOString(),
    copy: {
      card: courseGradeCard(spec, inputs, grade, release.settings, false),
      held: null,
      record: studentRecord(inputs, student),
    },
  };
}

/**
 * What one student sees: their card from the open class release, or from
 * their own update when it is newer; "withdrawn" when the latest release is
 * hidden; "none" before any release that names them.
 */
export function ownCourseGrade({
  student,
  release,
  releaseOpen,
  releaseOpenedAt,
  update,
  updateOpen,
  updateOpenedAt,
}: {
  student: string;
  release: CourseGradeRelease | null;
  releaseOpen: boolean | null;
  releaseOpenedAt: string | Date | null;
  update: CourseGradeUpdate | null;
  updateOpen: boolean | null;
  updateOpenedAt: string | Date | null;
}): { state: "none" | "withdrawn" | "released"; card: CourseGradeCard | null } {
  if (release == null) return { state: "none", card: null };
  if (!releaseOpen) return { state: "withdrawn", card: null };
  const newer =
    update != null &&
    updateOpen === true &&
    update.student === student &&
    time(updateOpenedAt!) >= time(releaseOpenedAt!);
  const card = newer ? update.copy.card : (release.students[student]?.card ?? null);
  return card === null ? { state: "none", card: null } : { state: "released", card };
}

/* ---------- Overrides and the download ---------- */

/** The grade an override replaces: the policy's letter after the attendance rule, now. */
export function overrideReplaced({
  specification,
  inputs,
  student,
  at,
}: {
  specification: CoursePolicy;
  inputs: CourseGradeInputs;
  student: string;
  at: Date;
}): string {
  return studentGrade(specification, inputs, student, at, at).policyGrade ?? "";
}

const CSV_HEADER_START = ["Student name", "Email", "Section"];
const CSV_HEADER_END = [
  "Average",
  "Grade",
  "Policy grade",
  "Reason",
  "Lectures attended",
  "Lectures",
  "Policy",
  "Version",
  "As of",
];

function csvField(value: string | number | null): string {
  if (value === null) return "";
  const raw =
    typeof value === "number"
      ? String(value)
      : /^[\t\r\n ]*[=+\-@]/.test(value)
        ? `'${value}`
        : value;
  return /[",\r\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

/** The final grades as CSV: one row per active student under the final policy, as of now. */
export function courseGradesCsv({
  policy,
  inputs,
  sections,
  at,
}: {
  policy: ReleasedPolicy;
  inputs: CourseGradeInputs;
  sections: { section: string; name: string }[];
  at: Date;
}): string {
  const spec = policy.specification;
  const sectionName = new Map(sections.map((entry) => [entry.section, entry.name]));
  const studentOf = new Map(inputs.students.map((student) => [student.user, student]));
  const groupNames = spec.groups.map((group) => group.name);
  const used = new Set([...CSV_HEADER_START, ...CSV_HEADER_END]);
  const groupHeaders = groupNames.map((name) => {
    let header = name;
    for (let n = 2; used.has(header); n += 1) header = `${name} (${n})`;
    used.add(header);
    return header;
  });
  const rows = courseGrades(spec, inputs, at, at).map((grade) => {
    const student = studentOf.get(grade.student)!;
    return [
      student.name,
      student.email,
      student.section === null ? "" : (sectionName.get(student.section) ?? ""),
      ...grade.groups.map((group) => group.value),
      grade.average,
      grade.grade,
      grade.policyGrade,
      grade.override?.reason ??
        (grade.cappedBy ? `Fewer than ${grade.cappedBy.below}% of lectures` : ""),
      grade.lectures.attended,
      grade.lectures.total,
      policy.name,
      policy.version,
      at.toISOString(),
    ];
  });
  return [[...CSV_HEADER_START, ...groupHeaders, ...CSV_HEADER_END], ...rows]
    .map((row) => row.map(csvField).join(","))
    .join("\r\n")
    .concat("\r\n");
}

/* ---------- The policy's shape ---------- */

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const text = (value: unknown): value is string => typeof value === "string";

/** Whether a value is a complete policy specification, checked before it is saved. */
export function policyIsWellFormed({ specification }: { specification: CoursePolicy }): boolean {
  const spec = specification as CoursePolicy | null;
  if (spec === null || typeof spec !== "object") return false;
  if (!spec.ratings || !RATING_NAMES.every((name) => finite(spec.ratings[name]))) return false;
  if (!finite(spec.missing) || !["missing", "graded"].includes(spec.late)) return false;
  if (!["letters", "plusMinus"].includes(spec.gradeSet)) return false;
  if (
    !spec.lines ||
    !(["letters", "plusMinus"] as const).every((set) => Array.isArray(spec.lines[set]))
  )
    return false;
  if (
    !Object.values(spec.lines).every((lines) =>
      lines.every((line) => text(line.grade) && finite(line.at)),
    )
  )
    return false;
  if (!spec.skillWeights || typeof spec.skillWeights !== "object") return false;
  if (
    !Object.values(spec.skillWeights).every((weights) => Object.values(weights ?? {}).every(finite))
  )
    return false;
  if (!Array.isArray(spec.attendance)) return false;
  if (!spec.attendance.every((rule) => text(rule.key) && finite(rule.below) && text(rule.atMost)))
    return false;
  if (!Array.isArray(spec.groups)) return false;
  return spec.groups.every(
    (group) =>
      text(group.key) &&
      text(group.name) &&
      finite(group.weight) &&
      group.weight >= 0 &&
      ["average", "best", "dropLowest"].includes(group.combine) &&
      Array.isArray(group.rows) &&
      group.rows.every(
        (row) =>
          text(row.key) &&
          finite(row.weight) &&
          row.weight >= 0 &&
          ((row.type === "assignment" && text(row.assignment)) ||
            (row.type === "skill" &&
              text(row.standard) &&
              ["latest", "best", "average"].includes(row.count) &&
              ["personal", "all"].includes(row.from))),
      ),
  );
}

/* ---------- The class headline's hint ---------- */

/** What the class's grades leave out or count as Missing, for the hint under the headline. */
export function notCounted(grades: StudentGrade[]): {
  drafts: number;
  draftStudents: number;
  excused: number;
  notDue: number;
  missing: number;
  late: number;
} {
  const all = grades.flatMap((grade) => Object.values(grade.work));
  const count = (status: WorkStatus) => all.filter((work) => work.status === status).length;
  const notDueAssignments = new Set(
    all.filter((work) => work.status === "notDue").map((work) => work.assignment),
  );
  return {
    drafts: count("draft") + count("ungraded"),
    draftStudents: grades.filter((grade) =>
      Object.values(grade.work).some(
        (work) => work.status === "draft" || work.status === "ungraded",
      ),
    ).length,
    excused: count("excused"),
    notDue: notDueAssignments.size,
    missing: count("missing"),
    late: count("late"),
  };
}

/* ---------- Small pieces the endpoints read through ---------- */

/** The user identities of the active students. */
export function studentUsers({ students }: { students: { user: string }[] }): string[] {
  return students.map((student) => student.user);
}

/** The final policy as a release keeps it. */
export function releasedPolicy({
  policy,
  name,
  version,
  specification,
}: ReleasedPolicy): ReleasedPolicy {
  return { policy, name, version, specification };
}

/** Whether a release's settings are complete: a readable cutoff and three switches. */
export function validReleaseSettings({
  dueBy,
  breakdown,
  letter,
  includeOverrides,
  release,
}: {
  dueBy: string;
  breakdown: boolean;
  letter: boolean;
  includeOverrides: boolean;
  release: string[];
}): boolean {
  return (
    typeof dueBy === "string" &&
    Number.isFinite(Date.parse(dueBy)) &&
    typeof breakdown === "boolean" &&
    typeof letter === "boolean" &&
    typeof includeOverrides === "boolean" &&
    Array.isArray(release) &&
    release.every((entry) => typeof entry === "string")
  );
}

/** A release's settings; overrides go with the letter, so they are off without it. */
export function releaseSettings({
  dueBy,
  breakdown,
  letter,
  includeOverrides,
}: ReleaseSettings): ReleaseSettings {
  return {
    dueBy: new Date(dueBy).toISOString(),
    breakdown,
    letter,
    includeOverrides: letter && includeOverrides,
  };
}

/** What staff see of a class release: every card and who was held, without the inputs. */
export type ReleaseSummary = Omit<CourseGradeRelease, "course" | "students"> & {
  cards: Record<string, CourseGradeCard>;
  held: Record<string, string[]>;
};

/** What staff see of an update: its card, without the inputs. */
export type UpdateSummary = Omit<CourseGradeUpdate, "course" | "copy"> & { card: CourseGradeCard };

/** What staff see of a release or an update: everything but the inputs it was computed from. */
export function releaseSummary({
  value,
}: {
  value: CourseGradeRelease | CourseGradeUpdate | null;
}): ReleaseSummary | UpdateSummary | null {
  if (value === null) return null;
  if (value.kind === "update") {
    const { course: _course, copy, ...summary } = value;
    return { ...summary, card: copy.card };
  }
  const { course: _course, students, ...summary } = value;
  const cards: Record<string, CourseGradeCard> = {};
  const held: Record<string, string[]> = {};
  for (const [student, copy] of Object.entries(students)) {
    cards[student] = copy.card;
    if (copy.held !== null) held[student] = copy.held;
  }
  return { ...summary, cards, held };
}
