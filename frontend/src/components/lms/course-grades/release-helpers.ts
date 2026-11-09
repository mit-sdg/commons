/**
 * The release dialog's and the release line's arithmetic, kept apart from the
 * components so it can be tested: the review list and its reasons in words,
 * the late-as-Missing count, the dialog's settings as `ReleaseSettings`, and
 * how far the released copies have drifted from today's grades.
 */

import {
  type CourseGradesPage,
  endOfDay,
  type ReleaseEntry,
} from "@/lib/course-grades";
import {
  type CourseGradeCard,
  type CourseGradeInputs,
  type CoursePolicy,
  courseGradeCard,
  courseGrades,
  holdReasons,
  type ReleaseSettings,
  type ReleaseSummary,
  type StudentGrade,
  type UpdateSummary,
  type WorkResult,
} from "../../../../../src/computations/course-grades.ts";

export type { ReleaseSummary };

function number(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(2)));
}

/**
 * One assignment's work in words for the review list, when it is counted as
 * Missing or left out of what counts, by its full title, since two titles
 * can share the part before a colon: "P4: Code complete late, no late days: 0",
 * "E2 missing: 0", "P3 draft", "P2 not graded yet".
 */
export function workWords(
  work: WorkResult,
  name: string,
  missing: number,
): string | null {
  switch (work.status) {
    case "late":
      return `${name} late, no late days: ${number(missing)}`;
    case "missing":
      return `${name} missing: ${number(missing)}`;
    case "draft":
      return `${name} draft`;
    case "ungraded":
      return `${name} not graded yet`;
    default:
      return null;
  }
}

export interface ReviewRow {
  student: string;
  name: string;
  average: number | null;
  grade: string | null;
  /** "Below C" first when it applies, then the zeroed or left-out work in due order. */
  reasons: string[];
}

/** Every student a release holds, with the reasons in words, by name. */
export function reviewList(
  policy: CoursePolicy,
  inputs: Pick<CourseGradeInputs, "assignments" | "students">,
  grades: StudentGrade[],
): ReviewRow[] {
  const titleOf = new Map(
    inputs.assignments.map((entry) => [entry.assignment, entry.title]),
  );
  const nameOf = new Map(
    inputs.students.map((student) => [student.user, student.name]),
  );
  return grades
    .flatMap((grade): ReviewRow[] => {
      const held = holdReasons(policy, grade);
      if (held.length === 0) return [];
      const work = Object.values(grade.work).flatMap((entry) => {
        const words = workWords(
          entry,
          titleOf.get(entry.assignment) ?? "",
          policy.missing,
        );
        return words ? [words] : [];
      });
      return [
        {
          student: grade.student,
          name: nameOf.get(grade.student) ?? grade.student,
          average: grade.average,
          grade: grade.grade,
          reasons: [...(held.includes("below C") ? ["Below C"] : []), ...work],
        },
      ];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** How many students have work handed in late, without late days, counted as Missing. */
export function lateAsMissingCount(grades: StudentGrade[]): number {
  return grades.filter((grade) =>
    Object.values(grade.work).some(
      (work) => work.counted && work.status === "late",
    ),
  ).length;
}

/** "4 students have late work counted as 0". */
export function lateWarning(students: number, missing: number): string {
  return students === 1
    ? `1 student has late work counted as ${number(missing)}`
    : `${students} students have late work counted as ${number(missing)}`;
}

/** The dialog's controls as they are sent. */
export interface ReleaseForm {
  /** A day, "2026-11-12", in the class time zone. */
  date: string;
  breakdown: boolean;
  letter: boolean;
  includeOverrides: boolean;
}

/** The settings a release sends: the end of the chosen day, and overrides only with the letter. */
export function settingsFrom(
  form: ReleaseForm,
  timezone: string | null,
): ReleaseSettings {
  return {
    dueBy: endOfDay(form.date, timezone),
    breakdown: form.breakdown,
    letter: form.letter,
    includeOverrides: form.letter && form.includeOverrides,
  };
}

/** The day an instant falls on in the class time zone, "2026-11-12", for a date input. */
export function dayIn(at: string | Date, timezone: string | null): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone ?? "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
}

/** The form a dialog opens with: the newest release's settings, open or hidden, else today with the defaults. */
export function startingForm(
  latest: ReleaseSummary | null,
  timezone: string | null,
  now: Date,
): ReleaseForm {
  if (latest)
    return {
      date: dayIn(latest.settings.dueBy, timezone),
      breakdown: latest.settings.breakdown,
      letter: latest.settings.letter,
      includeOverrides: latest.settings.letter
        ? latest.settings.includeOverrides
        : true,
    };
  return {
    date: dayIn(now, timezone),
    breakdown: true,
    letter: false,
    includeOverrides: true,
  };
}

/** A release entry's class release, or null for an entry without one. */
export function releaseOf(entry: ReleaseEntry): ReleaseSummary | null {
  const value = entry.release as unknown as
    | ReleaseSummary
    | UpdateSummary
    | null;
  return value && value.kind === "release" ? value : null;
}

const time = (value: string | Date | null | undefined) =>
  value == null ? 0 : new Date(value).getTime();

/** The page's releases, newest first. */
export function releasesNewestFirst(page: Pick<CourseGradesPage, "releases">) {
  return [...page.releases].sort(
    (left, right) => time(right.openedAt) - time(left.openedAt),
  );
}

/** The newest release, whether open or hidden. */
export function latestRelease(page: Pick<CourseGradesPage, "releases">) {
  return releasesNewestFirst(page)[0] ?? null;
}

/** The open release, if any. */
export function openRelease(page: Pick<CourseGradesPage, "releases">) {
  return releasesNewestFirst(page).find((entry) => entry.open) ?? null;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value ?? null);
}

/** Whether two cards say the same thing. */
export function sameCard(
  left: CourseGradeCard,
  right: CourseGradeCard,
): boolean {
  return stable(left) === stable(right);
}

/**
 * Each student's copy under a release: their own update when it is at least
 * as new as the release, else the release's card.
 */
export function currentCopies(
  page: Pick<CourseGradesPage, "updates">,
  entry: ReleaseEntry,
): Map<string, CourseGradeCard> {
  const release = releaseOf(entry);
  const copies = new Map<string, CourseGradeCard>(
    release
      ? (Object.entries(release.cards) as [string, CourseGradeCard][])
      : [],
  );
  const newest = new Map<string, number>();
  for (const update of page.updates) {
    const value = update.update as unknown as UpdateSummary | null;
    if (!value || value.kind !== "update") continue;
    const at = time(update.openedAt);
    if (at < time(entry.openedAt)) continue;
    const student = String(update.student);
    if (at < (newest.get(student) ?? -Infinity)) continue;
    newest.set(student, at);
    copies.set(student, value.card);
  }
  return copies;
}

/** Whether a student's copy under the open release is held; false without a copy. */
export function copyHeld(
  page: Pick<CourseGradesPage, "updates">,
  entry: ReleaseEntry,
  student: string,
): boolean {
  return currentCopies(page, entry).get(student)?.status === "held";
}

/**
 * The students a dialog starts on Release: those the newest release, open or
 * hidden, released by name. Their copy is released although that release's
 * own policy and cutoff hold them over today's work. A student held only by
 * a later cutoff or another policy starts on Hold.
 */
export function releasedByName(
  page: Pick<CourseGradesPage, "inputs" | "updates">,
  entry: ReleaseEntry | null,
  now: Date,
): Set<string> {
  const release = entry ? releaseOf(entry) : null;
  if (!entry || !release) return new Set();
  const spec = release.policy.specification;
  const copies = currentCopies(page, entry);
  return new Set(
    courseGrades(spec, page.inputs, new Date(release.settings.dueBy), now)
      .filter(
        (grade) =>
          copies.get(grade.student)?.status === "released" &&
          holdReasons(spec, grade).length > 0,
      )
      .map((grade) => grade.student),
  );
}

/** "Release to 45 students": the footer button, counting students who will see a grade. */
export function releaseLabel(students: number): string {
  return students === 1
    ? "Release to 1 student"
    : `Release to ${students} students`;
}

export interface SinceRelease {
  /** The final policy is another policy, or saved again, since the release. */
  policyMoved: boolean;
  /** Released copies that today's inputs, under the release's own policy and settings, no longer give. */
  stale: number;
  changed: boolean;
}

/**
 * How the open release stands against today. Each student's copy is their
 * own update when it is at least as new as the release, else the release's
 * card; today's card comes from the release's policy and settings over the
 * current inputs, held when the copy was held and a reason still holds them.
 */
export function sinceRelease(
  page: Pick<CourseGradesPage, "inputs" | "policies" | "updates">,
  entry: ReleaseEntry,
  now: Date,
): SinceRelease {
  const release = releaseOf(entry);
  if (!release) return { policyMoved: false, stale: 0, changed: false };
  const final = page.policies.find((policy) => policy.final) ?? null;
  const policyMoved =
    final === null ||
    final.policy !== release.policy.policy ||
    final.version !== release.policy.version;
  const spec = release.policy.specification;
  const copies = currentCopies(page, entry);
  const grades = courseGrades(
    spec,
    page.inputs,
    new Date(release.settings.dueBy),
    now,
  );
  let stale = 0;
  for (const grade of grades) {
    const copy = copies.get(grade.student);
    if (!copy) continue;
    const held = copy.status === "held" && holdReasons(spec, grade).length > 0;
    const today = courseGradeCard(
      spec,
      page.inputs,
      grade,
      release.settings,
      held,
    );
    if (!sameCard(copy, today)) stale += 1;
  }
  return { policyMoved, stale, changed: policyMoved || stale > 0 };
}

/** The switches a release had on, by their dialog labels. */
export function settingsWords(settings: ReleaseSettings): string[] {
  return [
    ...(settings.breakdown ? ["Breakdown by group"] : []),
    ...(settings.letter ? ["Letter grade"] : []),
    ...(settings.letter && settings.includeOverrides
      ? ["Include overrides"]
      : []),
  ];
}

export interface HistoryRow {
  edition: string;
  authorName: string | null;
  openedAt: string;
  /** How the release stopped showing: hidden, or replaced by the next release. */
  ended: { word: "Hidden" | "Replaced"; at: string } | null;
  policyName: string;
  version: number;
  settings: ReleaseSettings;
  held: number;
}

/** Every release, newest first, as the history lists it. */
export function historyRows(
  page: Pick<CourseGradesPage, "releases">,
): HistoryRow[] {
  const newest = releasesNewestFirst(page);
  return newest.flatMap((entry, index): HistoryRow[] => {
    const release = releaseOf(entry);
    if (!release) return [];
    const next = newest[index - 1];
    const closedAt = entry.closedAt == null ? null : String(entry.closedAt);
    const replaced =
      closedAt !== null &&
      next !== undefined &&
      Math.abs(time(next.openedAt) - time(closedAt)) < 60_000;
    return [
      {
        edition: String(entry.edition),
        authorName: entry.authorName ?? null,
        openedAt: String(entry.openedAt),
        ended:
          closedAt === null
            ? null
            : { word: replaced ? "Replaced" : "Hidden", at: closedAt },
        policyName: release.policy.name,
        version: release.policy.version,
        settings: release.settings,
        held: Object.keys(release.held).length,
      },
    ];
  });
}
