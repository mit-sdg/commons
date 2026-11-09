/**
 * Pure helpers for the class pane: ranking, the divider rows at the cutoffs,
 * the filters, the headline and its hint, stale overrides, and the order of
 * the By skill grid. The pane's components render what these return.
 */
import type {
  CourseGradeCard,
  CourseGradeInputs,
  CourseGradesPage,
  CoursePolicy,
  ReleaseEntry,
  ReleaseSettings,
  ShowAs,
  StudentGrade,
} from "@/lib/course-grades";
import { gradeOrder, nearCutoff, showAverage } from "@/lib/course-grades";
import {
  type AssignmentInput,
  belowC,
  countedAssignments,
  type GradeLine,
  holdReasons,
  type RatingName,
  TEAM_KIND,
  type WorkStatus,
} from "../../../../../src/computations/course-grades.ts";
import { currentCopies, releaseOf } from "./release-helpers";

export type { AssignmentInput, RatingName, WorkStatus };
export { TEAM_KIND };

/* ---------- Letters as the screen shows them ---------- */

const MIT_GPA: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 0 };

/** A policy letter as Show as displays it: "B", or "4.0" for MIT GPA. */
export function showLetter(
  letter: string,
  policy: CoursePolicy,
  showAs: ShowAs,
): string {
  if (showAs === "gpa") return (MIT_GPA[letter[0] ?? "F"] ?? 0).toFixed(1);
  if (showAs === "letters" && policy.gradeSet === "plusMinus")
    return letter[0] ?? letter;
  return letter;
}

/* ---------- Ranking and dividers ---------- */

/** Students ranked by Average, highest first; students without one go last, by name. */
export function rankGrades(
  grades: readonly StudentGrade[],
  nameOf: (student: string) => string,
): StudentGrade[] {
  return [...grades].sort((left, right) => {
    if (left.average !== right.average) {
      if (left.average === null) return 1;
      if (right.average === null) return -1;
      return right.average - left.average;
    }
    return nameOf(left.student).localeCompare(nameOf(right.student));
  });
}

export type TableRow =
  | { kind: "student"; grade: StudentGrade }
  | { kind: "divider"; line: GradeLine };

/**
 * The ranked rows with a divider wherever a cutoff falls between two
 * neighbours: above the divider every average is at or over the line, below
 * it every average is under it.
 */
export function withDividers(
  ranked: readonly StudentGrade[],
  lines: readonly GradeLine[],
): TableRow[] {
  const byHeight = [...lines].sort((left, right) => right.at - left.at);
  const rows: TableRow[] = [];
  let previous: number | null = null;
  for (const grade of ranked) {
    const average = grade.average;
    if (previous !== null && average !== null)
      for (const line of byHeight)
        if (previous >= line.at && average < line.at)
          rows.push({ kind: "divider", line });
    rows.push({ kind: "student", grade });
    if (average !== null) previous = average;
  }
  return rows;
}

/* ---------- Filters ---------- */

export type Chip = "changed" | "everyone" | "near" | "belowC" | "adjusted";

/** The chips always shown; Changed joins them while comparing. */
export const CHIPS: [Chip, string][] = [
  ["everyone", "Everyone"],
  ["near", "Near a line"],
  ["belowC", "Below C"],
  ["adjusted", "Overrides and attendance"],
];

/** One filter at a time: a chip, or a letter from the counts. */
export type Filter = { chip: Chip } | { letter: string };

export interface Filters {
  filter: Filter;
  search: string;
  /** A section id, or "" for every section. */
  section: string;
}

export const NO_FILTERS: Filters = {
  filter: { chip: "everyone" },
  search: "",
  section: "",
};

/** Whether a grade is limited by attendance or overridden. */
export const adjusted = (grade: StudentGrade) =>
  grade.override !== null || grade.cappedBy !== null;

export function matchesFilters(
  grade: StudentGrade,
  student: { name: string; email: string; section: string | null } | undefined,
  policy: CoursePolicy,
  filters: Filters,
  /** While comparing, the students who change; Changed shows only them. */
  changed: ReadonlySet<string> | null = null,
): boolean {
  const search = filters.search.trim().toLowerCase();
  if (
    search &&
    !(
      student?.name.toLowerCase().includes(search) ||
      student?.email.toLowerCase().includes(search)
    )
  )
    return false;
  if (filters.section && student?.section !== filters.section) return false;
  const { filter } = filters;
  if ("letter" in filter) return grade.grade === filter.letter;
  switch (filter.chip) {
    case "changed":
      return changed === null || changed.has(grade.student);
    case "near":
      return nearCutoff(grade, policy);
    case "belowC":
      return grade.grade !== null && belowC(policy, grade.grade);
    case "adjusted":
      return adjusted(grade);
    default:
      return true;
  }
}

export function isFiltered(filters: Filters): boolean {
  return (
    !("chip" in filters.filter && filters.filter.chip === "everyone") ||
    filters.search.trim() !== "" ||
    filters.section !== ""
  );
}

/* ---------- Overrides ---------- */

/** The policy grade now, when an override replaced a different one; null otherwise. */
export function movedPolicyGrade(grade: StudentGrade): string | null {
  if (!grade.override || grade.policyGrade === null) return null;
  return grade.override.replaced === grade.policyGrade
    ? null
    : grade.policyGrade;
}

/** The Reason column: the override's reason, else the attendance rule that limits the grade. */
export function reasonOf(grade: StudentGrade): string {
  if (grade.override) return grade.override.reason;
  if (grade.cappedBy)
    return `Fewer than ${grade.cappedBy.below}% of lectures, grade at most ${grade.cappedBy.atMost}`;
  return "";
}

/* ---------- The headline and its hint ---------- */

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * The class headline: "B, median of 64 students", or while comparing
 * "24 students change letter". The compared policy is named on its button.
 */
export function headline({
  grades,
  median,
  comparison,
}: {
  grades: readonly StudentGrade[];
  /** The median letter as shown, or null when no student has a grade. */
  median: string | null;
  /**
   * While comparing: how many students differ under it, and whether they
   * differ by letter or, for copies released without letters, by average.
   */
  comparison: {
    differ: number;
    by?: "letter" | "average";
  } | null;
}): string {
  if (comparison) {
    const n = comparison.differ;
    const what = comparison.by === "average" ? "average" : "letter";
    if (n === 0) return `No student changes ${what}`;
    return `${plural(n, "student changes", "students change")} ${what}`;
  }
  if (grades.length === 0) return "No students yet";
  if (median === null) return "No grades yet";
  return `${median}, median of ${plural(grades.length, "student", "students")}`;
}

/** The students whose policy letter differs between two sets of grades. */
export function differentLetters(
  grades: readonly StudentGrade[],
  compared: readonly StudentGrade[],
): Set<string> {
  const other = new Map(compared.map((grade) => [grade.student, grade]));
  const differ = new Set<string>();
  for (const grade of grades) {
    const theirs = other.get(grade.student);
    if (theirs && theirs.policyGrade !== grade.policyGrade)
      differ.add(grade.student);
  }
  return differ;
}

/* ---------- What students see ---------- */

/** What one student's current copy shows: held, a letter, or an average on the rating scale. */
export type CopyShows =
  | { kind: "held" }
  | { kind: "letter"; letter: string; includeOverrides: boolean }
  | { kind: "average"; average: number | null };

/** What a card shows, under the settings it was released with. */
export function copyShows(
  card: CourseGradeCard,
  settings: ReleaseSettings,
): CopyShows {
  if (card.status === "held") return { kind: "held" };
  if (card.letter !== null)
    return {
      kind: "letter",
      letter: card.letter,
      includeOverrides: settings.includeOverrides,
    };
  return { kind: "average", average: card.average };
}

/** What each student's current copy shows: their update when newer, else the release's card. */
export function copiesShown(
  page: Pick<CourseGradesPage, "updates">,
  entry: ReleaseEntry,
): Map<string, CopyShows> {
  const release = releaseOf(entry);
  const shown = new Map<string, CopyShows>();
  if (!release) return shown;
  for (const [student, card] of currentCopies(page, entry))
    shown.set(student, copyShows(card, release.settings));
  return shown;
}

/**
 * Whether a copy shows something other than what the open policy gives
 * today: letter against letter when the copy shows one, average against
 * average otherwise. A held copy differs only once the student is no longer
 * held.
 */
export function copyDiffers(
  copy: CopyShows,
  grade: StudentGrade,
  policy: CoursePolicy,
): boolean {
  switch (copy.kind) {
    case "held":
      return holdReasons(policy, grade).length === 0;
    case "letter":
      return (
        copy.letter !==
        (copy.includeOverrides ? grade.grade : grade.policyGrade)
      );
    default:
      return copy.average !== grade.average;
  }
}

/** A copy in the Compared column: "Held", its letter as Show as shows it, or its average. */
export function showCopy(
  copy: CopyShows,
  policy: CoursePolicy,
  showAs: ShowAs,
): string {
  switch (copy.kind) {
    case "held":
      return "Held";
    case "letter":
      return showLetter(copy.letter, policy, showAs);
    default:
      return showAverage(copy.average, policy, showAs);
  }
}

/** The students who differ under a comparison: by copy for what students see, else by policy letter. */
export function differingStudents(
  grades: readonly StudentGrade[],
  policy: CoursePolicy,
  comparison: {
    grades: readonly StudentGrade[];
    copies: ReadonlyMap<string, CopyShows> | null;
  },
): Set<string> {
  const { copies } = comparison;
  if (!copies) return differentLetters(grades, comparison.grades);
  const differ = new Set<string>();
  for (const grade of grades) {
    const copy = copies.get(grade.student);
    if (copy && copyDiffers(copy, grade, policy)) differ.add(grade.student);
  }
  return differ;
}

/* ---------- What counts ---------- */

/** What the headline's hint counts: drafts by student, and each other kind of left-out or zeroed work. */
export function leftOut(grades: readonly StudentGrade[]): {
  draftStudents: number;
  ungraded: number;
  excused: number;
  notDue: number;
  missing: number;
  late: number;
} {
  const all = grades.flatMap((grade) => Object.values(grade.work));
  const count = (status: WorkStatus) =>
    all.filter((work) => work.status === status).length;
  return {
    draftStudents: grades.filter((grade) =>
      Object.values(grade.work).some((work) => work.status === "draft"),
    ).length,
    ungraded: count("ungraded"),
    excused: count("excused"),
    notDue: new Set(
      all
        .filter((work) => work.status === "notDue")
        .map((work) => work.assignment),
    ).size,
    missing: count("missing"),
    late: count("late"),
  };
}

/**
 * The hint under the headline, naming each count only when it isn't zero:
 * "Not counted: drafts from 2 students, 3 submissions not graded yet, 2 excused, 5
 * assignments not due yet. 6 missing assignments count as 0." Null when there
 * is nothing to say.
 */
export function notCountedHint(
  counts: {
    draftStudents: number;
    ungraded: number;
    excused: number;
    notDue: number;
    missing: number;
    late: number;
  },
  missingValue: number,
): string | null {
  const left: string[] = [];
  if (counts.draftStudents > 0)
    left.push(
      `drafts from ${plural(counts.draftStudents, "student", "students")}`,
    );
  if (counts.ungraded > 0)
    left.push(
      `${plural(counts.ungraded, "submission", "submissions")} not graded yet`,
    );
  if (counts.excused > 0) left.push(`${counts.excused} excused`);
  if (counts.notDue > 0)
    left.push(
      `${plural(counts.notDue, "assignment", "assignments")} not due yet`,
    );
  const sentences: string[] = [];
  if (left.length > 0) sentences.push(`Not counted: ${left.join(", ")}.`);
  const zeroed = counts.missing + counts.late;
  if (zeroed > 0) {
    const verb = zeroed === 1 ? "counts" : "count";
    const what =
      counts.missing > 0 && counts.late > 0
        ? `${counts.missing} missing and ${counts.late} late assignments`
        : counts.missing > 0
          ? `${plural(counts.missing, "missing assignment", "missing assignments")}`
          : `${plural(counts.late, "late assignment", "late assignments")}`;
    sentences.push(`${what} ${verb} as ${missingValue}.`);
  }
  return sentences.length > 0 ? sentences.join(" ") : null;
}

/* ---------- The dot strip ---------- */

/**
 * The strip's range: from the lowest average (or the lowest cutoff, so every
 * cutoff can be dragged) to the top of the rating scale.
 */
export function stripRange(
  grades: readonly StudentGrade[],
  policy: CoursePolicy,
): { low: number; high: number } {
  const averages = grades
    .map((grade) => grade.average)
    .filter((average): average is number => average !== null);
  const lines = policy.lines[policy.gradeSet].map((line) => line.at);
  const ratings = Object.values(policy.ratings);
  const high = Math.max(...ratings, ...averages);
  const lowest = Math.min(
    ...(averages.length > 0 ? averages : ratings),
    ...lines,
  );
  const low = Math.floor((lowest - 0.05) * 10) / 10;
  return { low: Math.min(low, high - 0.5), high };
}

/**
 * A cutoff moved to `at`, kept between its neighbours (0.05 apart) and inside
 * the range, rounded to two decimals.
 */
export function moveLine(
  policy: CoursePolicy,
  grade: string,
  at: number,
  range: { low: number; high: number },
): CoursePolicy {
  const lines = policy.lines[policy.gradeSet];
  const sorted = [...lines].sort((left, right) => right.at - left.at);
  const index = sorted.findIndex((line) => line.grade === grade);
  if (index < 0) return policy;
  const above = sorted[index - 1]?.at ?? range.high + 0.05;
  const below = sorted[index + 1]?.at ?? range.low - 0.05;
  const clamped = Math.min(above - 0.05, Math.max(below + 0.05, at));
  const rounded = Math.round(clamped * 100) / 100;
  return {
    ...policy,
    lines: {
      ...policy.lines,
      [policy.gradeSet]: lines.map((line) =>
        line.grade === grade ? { ...line, at: rounded } : line,
      ),
    },
  };
}

/** Dots stacked into columns `size` pixels wide, lowest average first. */
export function stackDots(
  grades: readonly StudentGrade[],
  x: (average: number) => number,
  size: number,
): { student: string; average: number; left: number; layer: number }[] {
  const heights = new Map<number, number>();
  return grades
    .filter((grade) => grade.average !== null)
    .sort((left, right) => left.average! - right.average!)
    .map((grade) => {
      const column = Math.round(x(grade.average!) / size);
      const layer = heights.get(column) ?? 0;
      heights.set(column, layer + 1);
      return {
        student: grade.student,
        average: grade.average!,
        left: column * size,
        layer,
      };
    });
}

/* ---------- An opened student ---------- */

/** A group's weight as its share of all group weights, "70% weight". */
export function groupShare(policy: CoursePolicy, weight: number): number {
  const total = policy.groups.reduce((sum, group) => sum + group.weight, 0);
  return total > 0 ? Math.round((weight / total) * 100) : 0;
}

/** The word on an assignment row that is left out or counts as Missing. */
export function statusWord(status: WorkStatus, missing: number): string | null {
  switch (status) {
    case "missing":
      return `missing: ${missing}`;
    case "late":
      return `late, no late days: ${missing}`;
    case "lateRated":
      return "late, counted";
    case "excused":
      return "excused, left out";
    case "draft":
      return "draft, left out";
    case "ungraded":
      return "not graded yet, left out";
    case "notDue":
      return "not due yet";
    case "notAssigned":
      return "not assigned";
    case "notAssessed":
      return "not assessed, left out";
    default:
      return null;
  }
}

/**
 * Short names for a set of names, the way the Grades tab shortens grader
 * names: initials when they tell every name apart, else first words, else the
 * names whole.
 */
export function shortNames(names: readonly string[]): Map<string, string> {
  const forms = [
    (name: string) =>
      name
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => (/^\d+$/.test(word) ? word : word[0]!.toUpperCase()))
        .join(""),
    (name: string) => name.split(/\s+/)[0] ?? name,
    (name: string) => name,
  ];
  const unique = [...new Set(names)];
  for (const form of forms) {
    const said = unique.map(form);
    if (new Set(said).size === said.length || form === forms.at(-1))
      return new Map(unique.map((name, index) => [name, said[index]!]));
  }
  return new Map();
}

/**
 * Short assignment captions: the title before any colon, as initials with
 * numbers kept ("Exercise 1: Problem Framing" → "E1", "P1: Design" → "P1").
 * A caption two assignments share falls back to the title before the colon.
 */
export function assignmentCaptions(
  assignments: readonly { assignment: string; title: string }[],
): Map<string, string> {
  const head = (title: string) => title.split(":")[0]!.trim() || title;
  const initials = (title: string) => {
    const words = head(title).split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0]!;
    return words
      .map((word) => (/\d/.test(word) ? word : word[0]!.toUpperCase()))
      .join("");
  };
  const counts = new Map<string, number>();
  for (const { title } of assignments)
    counts.set(initials(title), (counts.get(initials(title)) ?? 0) + 1);
  return new Map(
    assignments.map(({ assignment, title }) => [
      assignment,
      counts.get(initials(title)) === 1 ? initials(title) : head(title),
    ]),
  );
}

/** Each skill's name, by standard, from the criteria in the inputs. */
export function skillNames(inputs: CourseGradeInputs): Map<string, string> {
  const names = new Map<string, string>();
  for (const assessment of inputs.assessments)
    for (const criterion of assessment.criteria)
      if (
        criterion.kind === "COMPETENCY" &&
        criterion.standard &&
        !names.has(criterion.standard)
      )
        names.set(criterion.standard, criterion.name || criterion.standard);
  return names;
}

/** The skills each assignment rates, by standard. */
export function skillsByAssignment(
  inputs: CourseGradeInputs,
): Map<string, Set<string>> {
  const rated = new Map<string, Set<string>>();
  for (const assessment of inputs.assessments)
    for (const criterion of assessment.criteria)
      if (criterion.kind === "COMPETENCY" && criterion.standard)
        rated.set(
          assessment.item,
          (rated.get(assessment.item) ?? new Set()).add(criterion.standard),
        );
  return rated;
}

export interface BySkill {
  /** Assignments in due order that rate at least one skill. */
  assignments: AssignmentInput[];
  /** Skills in the order the term first rates them. */
  skills: { standard: string; name: string }[];
}

/** The By skill grid's rows and columns for the class's assignments. */
export function bySkill(inputs: CourseGradeInputs): BySkill {
  const rated = skillsByAssignment(inputs);
  const names = skillNames(inputs);
  const assignments = countedAssignments(inputs).filter(
    (assignment) => (rated.get(assignment.assignment)?.size ?? 0) > 0,
  );
  const first = new Map<string, number>();
  assignments.forEach((assignment, index) => {
    for (const standard of rated.get(assignment.assignment) ?? [])
      if (!first.has(standard)) first.set(standard, index);
  });
  const skills = [...first.keys()].map((standard) => ({
    standard,
    name: names.get(standard) ?? standard,
  }));
  skills.sort(
    (left, right) =>
      first.get(left.standard)! - first.get(right.standard)! ||
      left.name.localeCompare(right.name),
  );
  return { assignments, skills };
}

/** The letters an override can set: the policy's grade set, best first. */
export const overrideLetters = (policy: CoursePolicy) => gradeOrder(policy);

export const RATING_SHORT: Record<RatingName, string> = {
  DEFICIENT: "D",
  EMERGENT: "E",
  COMPETENT: "C",
  EXPERT: "Ex",
};
