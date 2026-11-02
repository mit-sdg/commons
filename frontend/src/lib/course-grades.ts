import type { Output } from "@/lib/api";
import { api, publicErrorMessage, unwrap } from "@/lib/api";
import {
  type CourseGradeCard,
  type CourseGradeInputs,
  type CoursePolicy,
  courseGrades,
  type GradeSet,
  gradeOrder,
  lineGrade,
  notCounted,
  type PolicyGroup,
  type PolicyRow,
  policyIsWellFormed,
  type ReleaseSettings,
  type StudentGrade,
  TEAM_KIND,
} from "../../../src/computations/course-grades.ts";

export type {
  CourseGradeCard,
  CourseGradeInputs,
  CoursePolicy,
  GradeSet,
  PolicyGroup,
  PolicyRow,
  ReleaseSettings,
  StudentGrade,
};
export { courseGrades, gradeOrder, lineGrade, notCounted, policyIsWellFormed };

export type CourseGradesPage = NonNullable<
  Output<"/course-grades/read">["page"]
>;
export type PolicySummary = CourseGradesPage["policies"][number];
export type ReleaseEntry = CourseGradesPage["releases"][number];
export type StudentUpdate = CourseGradesPage["updates"][number];
export type MyCourseGrade = Output<"/course-grades/mine">["courseGrade"];

/* ---------- Reads and actions ---------- */

export async function loadCourseGradesPage(): Promise<CourseGradesPage | null> {
  return unwrap(await api["course-grades"].read({})).page;
}

/** A policy at its current version, with its specification. */
export async function loadPolicy(policy: string) {
  const read = unwrap(await api["course-grades"].policy({ policy }));
  return { ...read, specification: read.specification as CoursePolicy };
}

/** One saved version of a policy. */
export async function loadVersion(policy: string, version: number) {
  const read = unwrap(await api["course-grades"].version({ policy, version }));
  return { ...read, specification: read.specification as CoursePolicy };
}

export async function loadMyCourseGrade(): Promise<MyCourseGrade> {
  return unwrap(await api["course-grades"].mine({})).courseGrade;
}

type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code: string };

/** An action's answer, with a refusal's code and its message for a toast. */
async function attempt<T>(
  call: Promise<T>,
): Promise<Result<Exclude<T, { error: unknown }>>> {
  const result = await call;
  if (result && typeof result === "object" && "error" in result) {
    const code = (result as { error: unknown }).error;
    return {
      ok: false,
      code: String(code),
      error: publicErrorMessage(code as never),
    };
  }
  return { ok: true, value: result as Exclude<T, { error: unknown }> };
}

export const courseGradeActions = {
  create: (name: string, specification: CoursePolicy) =>
    attempt(api["course-grades"].create({ name, specification })),
  /** Refused with `CONFLICT` when someone saved since `version`. */
  save: (policy: string, version: number, specification: CoursePolicy) =>
    attempt(api["course-grades"].save({ policy, version, specification })),
  rename: (policy: string, name: string) =>
    attempt(api["course-grades"].rename({ policy, name })),
  remove: (policy: string) => attempt(api["course-grades"].remove({ policy })),
  markFinal: (policy: string) =>
    attempt(api["course-grades"]["mark-final"]({ policy })),
  setOverride: (
    student: string,
    value: string,
    reason: string,
    policy: string,
  ) =>
    attempt(api["course-grades"].override({ student, value, reason, policy })),
  clearOverride: (student: string) =>
    attempt(api["course-grades"]["clear-override"]({ student })),
  /** `release` names the held students staff released after a look. */
  release: (settings: ReleaseSettings, release: string[]) =>
    attempt(api["course-grades"].release({ ...settings, release })),
  updateStudent: (student: string, reason: string) =>
    attempt(api["course-grades"]["update-student"]({ student, reason })),
  hide: () => attempt(api["course-grades"].hide({})),
  exportCsv: () => attempt(api.grades.export({})),
};

/* ---------- A new policy ---------- */

let keys = 0;
/** A key for a new group or row, unique within the page. */
export function newKey(prefix = "k"): string {
  keys += 1;
  return `${prefix}${Date.now().toString(36)}${keys}`;
}

/**
 * A starting policy: Personal 70 with every assignment that is not a Final
 * project, Team 30 with the rest, each assignment weighing 1, the course
 * guide's rating values, and lines for both grade sets.
 */
export function startingPolicy(inputs: CourseGradeInputs): CoursePolicy {
  const accepting = inputs.assignments.filter(
    (assignment) => assignment.acceptsSubmissions,
  );
  const rows = (team: boolean): PolicyRow[] =>
    accepting
      .filter((assignment) => (assignment.kind === TEAM_KIND) === team)
      .map((assignment) => ({
        key: newKey("r"),
        type: "assignment",
        assignment: assignment.assignment,
        weight: 1,
      }));
  return {
    ratings: { DEFICIENT: 1, EMERGENT: 2, COMPETENT: 3, EXPERT: 4 },
    missing: 0,
    late: "missing",
    skillWeights: {},
    groups: [
      {
        key: newKey("g"),
        name: "Personal",
        weight: 70,
        combine: "average",
        rows: rows(false),
      },
      {
        key: newKey("g"),
        name: "Team",
        weight: 30,
        combine: "average",
        rows: rows(true),
      },
    ],
    attendance: [],
    gradeSet: "letters",
    lines: {
      letters: [
        { grade: "A", at: 3.4 },
        { grade: "B", at: 2.8 },
        { grade: "C", at: 2.2 },
        { grade: "D", at: 1.6 },
      ],
      plusMinus: [
        { grade: "A", at: 3.6 },
        { grade: "A−", at: 3.4 },
        { grade: "B+", at: 3.2 },
        { grade: "B", at: 3.0 },
        { grade: "B−", at: 2.8 },
        { grade: "C+", at: 2.6 },
        { grade: "C", at: 2.4 },
        { grade: "C−", at: 2.2 },
        { grade: "D", at: 1.8 },
      ],
    },
  };
}

/* ---------- Show as ---------- */

/** How the screen shows numbers and letters; it never changes a grade. */
export type ShowAs = "letters" | "plusMinus" | "percent" | "gpa";

export const SHOW_AS: { value: ShowAs; label: string }[] = [
  { value: "letters", label: "Letters" },
  { value: "plusMinus", label: "Letters with + and −" },
  { value: "percent", label: "Percent" },
  { value: "gpa", label: "MIT GPA" },
];

const MIT_GPA: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 0 };

/** An average on the rating scale, as the screen shows it: "2.71", "68%", or "4.0". */
export function showAverage(
  average: number | null,
  policy: CoursePolicy,
  showAs: ShowAs,
): string {
  if (average === null) return "–";
  if (showAs === "percent") {
    const high = Math.max(...Object.values(policy.ratings));
    return `${Math.round((average / high) * 100)}%`;
  }
  return average.toFixed(2);
}

/** A grade as the screen shows it: the letter in the chosen set, or its MIT GPA points. */
export function showGrade(
  grade: StudentGrade,
  policy: CoursePolicy,
  showAs: ShowAs,
): string {
  if (grade.grade === null) return "–";
  if (showAs === "gpa") return (MIT_GPA[grade.grade[0] ?? "F"] ?? 0).toFixed(1);
  if (showAs === "plusMinus" && policy.gradeSet === "letters") {
    if (grade.override || grade.cappedBy) return grade.grade;
    return grade.average === null
      ? "–"
      : lineGrade({ ...policy, gradeSet: "plusMinus" }, grade.average);
  }
  if (showAs === "letters" && policy.gradeSet === "plusMinus")
    return grade.grade[0] ?? grade.grade;
  return grade.grade;
}

/* ---------- Comparing policies ---------- */

const same = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * The policy settings that differ between two policies, named as the policy
 * pane names them: "Rating values", "Missing", "Late work", "Skill weights",
 * "Attendance", "Grade set", "Grade lines", and each group by name.
 */
export function differsIn(left: CoursePolicy, right: CoursePolicy): string[] {
  const names: string[] = [];
  if (!same(left.ratings, right.ratings)) names.push("Rating values");
  if (left.missing !== right.missing) names.push("Missing");
  if (left.late !== right.late) names.push("Late work");
  if (!same(left.skillWeights, right.skillWeights)) names.push("Skill weights");
  const groupsOf = (policy: CoursePolicy) =>
    new Map(policy.groups.map((group) => [group.name, group]));
  const leftGroups = groupsOf(left);
  const rightGroups = groupsOf(right);
  for (const name of new Set([...leftGroups.keys(), ...rightGroups.keys()])) {
    const a = leftGroups.get(name);
    const b = rightGroups.get(name);
    const strip = (group: PolicyGroup | undefined) =>
      group && {
        weight: group.weight,
        combine: group.combine,
        rows: group.rows.map((row) => ({ ...row, key: undefined })),
      };
    if (!same(strip(a), strip(b))) names.push(name);
  }
  const rules = (policy: CoursePolicy) =>
    policy.attendance.map((rule) => ({ ...rule, key: undefined }));
  if (!same(rules(left), rules(right))) names.push("Attendance");
  if (left.gradeSet !== right.gradeSet) names.push("Grade set");
  if (!same(left.lines[left.gradeSet], right.lines[right.gradeSet]))
    names.push("Grade lines");
  return names;
}

/**
 * What a newer save changed, for the banner shown when a save is refused:
 * "Team 30 → 40", "Missing 0 → 1", "C line 2.2 → 2.3", or a setting's name
 * when its change has no single number.
 */
export function changesBetween(
  older: CoursePolicy,
  newer: CoursePolicy,
): string[] {
  const changes: string[] = [];
  const named = new Set<string>();
  for (const group of newer.groups) {
    const before = older.groups.find((entry) => entry.key === group.key);
    if (before && before.weight !== group.weight) {
      changes.push(`${group.name} ${before.weight} → ${group.weight}`);
      named.add(group.name);
    }
  }
  if (older.missing !== newer.missing) {
    changes.push(`Missing ${older.missing} → ${newer.missing}`);
    named.add("Missing");
  }
  for (const line of newer.lines[newer.gradeSet]) {
    const before = older.lines[newer.gradeSet].find(
      (entry) => entry.grade === line.grade,
    );
    if (before && before.at !== line.at) {
      changes.push(`${line.grade} line ${before.at} → ${line.at}`);
      named.add("Grade lines");
    }
  }
  for (const name of differsIn(older, newer))
    if (!named.has(name)) changes.push(name);
  return changes;
}

/* ---------- The class at a glance ---------- */

/** The letters the policy grades with, best first, and how many students hold each. */
export function letterCounts(
  grades: StudentGrade[],
  policy: CoursePolicy,
): { grade: string; count: number }[] {
  return gradeOrder(policy).map((grade) => ({
    grade,
    count: grades.filter((entry) => entry.grade === grade).length,
  }));
}

/** The median letter, from the students who have a grade. */
export function medianGrade(
  grades: StudentGrade[],
  policy: CoursePolicy,
): string | null {
  const order = gradeOrder(policy);
  const ranks = grades
    .filter((grade) => grade.grade !== null)
    .map((grade) => order.indexOf(grade.grade!))
    .filter((rank) => rank >= 0)
    .sort((left, right) => left - right);
  if (ranks.length === 0) return null;
  return order[ranks[Math.floor((ranks.length - 1) / 2)]!] ?? null;
}

/** Whether an average sits within `margin` of a line. */
export function nearCutoff(
  grade: StudentGrade,
  policy: CoursePolicy,
  margin = 0.05,
): boolean {
  if (grade.average === null) return false;
  return policy.lines[policy.gradeSet].some(
    (line) =>
      Math.round(Math.abs(grade.average! - line.at) * 100) <=
      Math.round(margin * 100),
  );
}

/** The end of a chosen day, "2026-11-12", in the class time zone, as an instant. */
export function endOfDay(date: string, timezone: string | null): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = Date.UTC(year!, month! - 1, day!, 23, 59, 59);
  const zone = timezone ?? "UTC";
  const shown = new Date(
    new Date(utc).toLocaleString("en-US", { timeZone: zone }),
  ).getTime();
  const asUtc = new Date(
    new Date(utc).toLocaleString("en-US", { timeZone: "UTC" }),
  ).getTime();
  return new Date(utc - (shown - asUtc)).toISOString();
}
